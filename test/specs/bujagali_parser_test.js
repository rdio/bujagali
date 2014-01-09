describe('Bujagali Parser', function() {
  beforeEach(function() {
    var self = this;
    self.parser = new Bujagali.Parser();
    self.parse = function() {
      self.out = self.parser.parse.apply(self.parser, arguments);
      // Every call to parse should return valid javascript
      expect(function() {
        self.func = eval(self.out);
      }).not.toThrow();
    };
    self.contains = function(s) {
      expect(self.out).toContain(s);
    };
  });
  it('wraps everything in a function that provides done and emit', function() {
    var parsed = this.parser.parse('');
    expect(parsed).toContain('function(ctx, args) {');
    expect(parsed).toContain('done');
    expect(parsed).toContain('function emit(more)');
  });
  it('passes through literals', function() {
    this.parse('hello there');
    expect(this.out).toContain('hello there');
  });
  it('emits data', function() {
    this.parse('{{ data }}');
    expect(this.out).toContain('emit([data])');
  });
  it('can be executed', function () {
    this.parse('hello {{ ctx.planet }}');
    var markup = this.func.call({ markup: [], done: function(){} }, { planet: 'world' }).join('');
    expect(markup).toBe('hello world');
  });
  it('throws error when parentheses are mismatched', function() {
    var self = this;
    expect(function() {
      self.parser.parse('{{ data');
    }).toThrow('No end parenthesis in {{ data');
  });
  it('combines data and literals', function() {
    this.parse('Testing {{ data }} stuff');
    expect(this.out).toContain('emit(["Testing ",data," stuff"])');
  });
  it('allows arbitrary javascript', function() {
    var code = "if (thing) { doSomething(); }"
    this.parse('{%' + code + '%}');
    expect(this.out).toContain(code);
  });
  it('can have javascript and variables interspersed', function() {
    this.parse('This is a {{ variable }} and {% thisIsCode(); %} And {{ stuff }} can come after');
    this.contains('"This is a "');
    this.contains(',variable,');
    this.contains('thisIsCode();');
    this.contains('And');
    this.contains(',stuff,');
    this.contains(' can come after');
  });
  it('can escape data', function() {
    this.parse('{@ escaped @}');
    this.contains('self.escape(escaped)');
  });
  it('ignores comments', function() {
    this.parse('{# this should not appear {{ data }} should not be substituted #} Other stuff should be there');
    expect(this.out).not.toContain('this should not appear');
    expect(this.out).not.toContain('data');
    this.contains('Other stuff should be there');
  });
  it('localizes static strings', function() {
    this.parse('{_ this is "localized" _}');
    this.contains('t("this is \\"localized\\"")');
  });
  it('gets extended block', function() {
    this.parse('Some stuff {$ block $} end stuff');
    this.contains('Some stuff');
    this.contains('end stuff');
    this.contains('_getBlock(args._blockProviders, "block")');
  });
  it('gets default block', function() {
    this.parse('Some stuff {$ block $} end stuff');
    this.contains('Some stuff');
    this.contains('end stuff');
    this.contains('if (block) {block();} else {try { eval("block")(); } catch(e) {}}');
  }),
  it('can create macros', function() {
    this.after(function() {
      delete Bujagali.helpers.some_macro;
    });
    this.parse('{= some_macro(things) {_ Localized _} {% if (things) { someOtherThing(); } %} literal =}');
    this.contains('function(things)');
    this.func.call({ markup: [], done: function(){} }, {});
    expect(Bujagali.helpers.some_macro).toBeDefined();
    this.contains('t("Localized")');
    this.contains('if (things) { someOtherThing();');
    this.contains('" literal"');
  });
  it('can import other templates', function() {
    var import1 = 'some/other/template.bg.html';
    var import2 = 'another/template.bg.html';
    this.parse('#import ' + import1 +' \n #import ' + import2 + '\n');
    this.contains('new self.ctor("' + import1);
    this.contains('new self.ctor("' + import2);
  });
  it('cannot import things except for the beginning', function() {
    var self = this;
    expect(function() {
      self.parse('{{ doingWorkLikeKobe }} #import some/template\n{{moreStuff}}');
    }).toThrow('Cannot have anything before import statements');
  });
  it('can be extended', function() {
    this.parse('#extends base/template.bg.html\n Some other stuff');
    this.contains('base/template.bg.html');
    this.contains('render(');
    this.contains("Some other stuff");
  });
});
