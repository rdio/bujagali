/**
 * class Bujagali.Parser
 *
 * Bujagali template parser
 *
 * Runs on node.js or in the browser.
 **/

(function() {

  function escDQuotes(s) {
    return s.replace(/"/g, '\\"');
  }

  function escNewlines(s) {
    return s.replace(/\n/g, '\\n');
  }

   /**
    * new Bujagali.Parser(options)
    * - options (Object): Parser options.
    *
    * Available options:
    *
    *   * postFilter (`Function`): Called when the parser has finished 
    *     parsing input. Accepts one argument, the parsed template. Must 
    *     return a `String` with the new template contents.
    **/
  function Parser(options) {
    this.options = options || {};
    this.literals = [];
    this.imports = [];
    this.closedImports = [];
    this._compileRegExps();
  }

  var p = Parser.prototype;

  /**
   * Bujagali.Parser.tokens -> Array
   *
   * Characters in this array are recognized by the parser as delimiters for
   * tags.  Subclasses can override this to provide additional tags.  Each one
   * should have a corresponding function in `Bujagali.Parser.tokenHandlers`.
   **/
  p.tokens = ['{', '%', '=', '#', '$', '_', '@'];

  p._compileRegExps = function() {
    this._tokenizer = new RegExp('{([' + this.tokens.join('') + '])|#import|#extends');
    this._terminators = {};
    var token;
    for (var i = 0; i < this.tokens.length; i++) {
      token = this.tokens[i];
      this._terminators[token] = new RegExp('[' + token + ']}');
    }
    // Special cases
    this._terminators['{'] = new RegExp('}}'); // mustaches
    this._terminators['#extends'] = this._terminators['#import'] = new RegExp('\n');
  };

  p.parse = function(input) {
    this.start();
    this.recurse(input);
    this.finalize();
    var output = this.func.join('');

    // Don't retain strings
    this.func = null;
    this.closedImports = [];

    if (this.options.postFilter) {
      output = this.options.postFilter(output);
    }

    return output;
  };

  p.recurse = function(input) {
    var match = this._tokenizer.exec(input);
    if (match) {
      var start = match.index;
      this.rawLiteral(input.slice(0, start));
      var moreShit = this.transform(match[1] ? match[1] : match[0], input, start, match[0].length);
      if (moreShit) {
        this.recurse(moreShit);
      }
    } else {
      this.rawLiteral(input);
    }
  };

  p.rawLiteral = function(literal) {
    if (!literal) { return; }
    this.literals.push('"' + escNewlines(escDQuotes(literal)) + '"');
  };

  p.start = function() {
    this.extend = null;
    this.func = ["(function() { return (function(ctx, args) {",
      "var self = this;",
      "var done = function(post) {",
        "var markup = self.markup;",
        "if (args && args._blockProviders) {",
          "args._blockProviders = null;",
        "}",
        "self.done(post);",
        // don't leak if we have macros
        "ctx = null;",
        "args = null;",
        "self = null;",
        "done = function() {};",
        "return markup;",
      "};",
      "function emit(more) {",
        "Array.prototype.splice.apply(",
          "self.markup,",
          "[self.markup.length, more.length].concat(more));",
      "}"];
  };

  p.insertJavascriptCode = function(code) {
    this.collapseLiterals();
    this.func.push(code);
  };

  p.finalize = function() {
    this.collapseLiterals();
    this.renderExtend();
    this.func = this.func.concat(this.closedImports);
    this.func.push('return done();}); })();');
  };

  p.collapseLiterals = function() {
    this.collapseImports();
    if (!this.literals.length) {
      return;
    }
    this.func.push('emit([');
    for (var i = 0; i < this.literals.length - 1; i++) {
      this.func.push(this.literals[i] + ',');
    }
    // Do the last one outside the loop to avoid a trailing comma
    this.func.push(this.literals[this.literals.length - 1]);
    this.func.push(']);');
    this.literals = [];
  };

  p.collapseImports = function() {
    var uniqueName, i;
    if (!this.imports.length) {
      return;
    }
    if (this.lastToken && this.lastToken != '#import') {
      throw new Error('Cannot have anything before import statements');
    }
    // this is a two stage process. first start loading them, then call render.
    // This is an optimization.
    for (i = 0; i < this.imports.length; i++) {
      uniqueName = '__bg' + i;
      this.func.push([
        "var ", uniqueName, " = new self.ctor(\"", this.imports[i], "\", self.context, self.root);",
        uniqueName, ".load();"
      ].join(''));
    }
    for (i = 0; i < this.imports.length; i++) {
      uniqueName = '__bg' + i;
      this.func.push(uniqueName + '.renderOnce(self.context, function() {');
      this.closedImports.push('});');
    }
    this.imports = [];
  };

  p.renderExtend = function() {
    if (!this.extend) { return; }
    this.func.push([
      // Wrap this in a function so we don't leak these vars
      "(function() {",
        "var __extendArgs = self.args || {};",
        "if (!__extendArgs._blockProviders) {",
          "__extendArgs._blockProviders = [];",
        "}",
        "else {",
          "__extendArgs._blockProviders = __extendArgs._blockProviders.slice();",
        "}",
        "__extendArgs._blockProviders.push(function(functionName) { try { return eval(functionName) } catch(e) { return self.noBlockFound; } })",
        "var __bgextend = new self.ctor(\"" + this.extend + "\", self.context, self.root);",
        "__bgextend.view = self.view;",
        "__bgextend.render(self.context, function() {}, __extendArgs, self.markup);",
        // Need to keep a reference to the extended monad, so its state can be
        // updated.
        "self._extendMonad = __bgextend;",
      "})();"
    ].join('\n'));
  };

  p.transform = function(token, input, index, tokenLength) {
    var end = this._terminators[token].exec(input);
    if (!end) {
      throw new Error('No end parenthesis in ' + input);
    }
    this.lastToken = token;
    var handler = this.tokenHandlers[token];
    if (!handler) {
      throw new Error('unknown token ' + token + ' at ' + input.slice(0, 20));
    }
    handler.call(this, input.slice(index + tokenLength, end.index).trim());
    return input.slice(end.index + end[0].length);
  };

  /**
   * Bujagali.Parser.tokenHandlers -> Object
   *
   * Maps tokens from `Bujagali.Parser.tokens` to functions that will be run
   * when tags using those tokens are encountered by the parser.  Subclasses
   * can override to provide additional tags.  Each property of tokenHandlers
   * should have a corresponding String in `Bujagali.Parser.tokens`.
   **/
  p.tokenHandlers = {
    '{': function variable(body) {
      this.literals.push(body);
    },
    '@': function escaped(body) {
      this.literals.push('self.escape(' + body + ')');
    },
    '%': function code(body) {
      this.insertJavascriptCode(body);
    },
    '#': function comment(body) {
      return;
    },
    '_': function localize(body) {
      this.literals.push('t("' + escDQuotes(body) + '")');
    },
    '$': function block(body) {
      var name = escDQuotes(body);
      this.insertJavascriptCode([
        'var block = self._getBlock(args._blockProviders, "' + name + '");',
        'if (block) {',
          'block();',
        '} else {',
          'try { eval("' + name + '")(); } catch(e) {}',
        '}'
      ].join(''));
    },
    '=': function macro(body) {
      // this pulls out the function call parts of the macro
      var match = /(\w+)\s*(\(.*?\))/.exec(body);
      if (!match) {
        throw new Error("Bad macro definition '" + body.slice(0, 20) + "'");
      }
      var functionName = match[1],
        functionArgs = match[2];

      this.insertJavascriptCode(["Bujagali.helpers['", functionName, "'] = function",
        functionArgs, "{",
        "var __bujagali_html = [];",
        "var self = this;",
        "function emit(more) {",
          "Array.prototype.splice.apply(",
            "__bujagali_html,",
            "[__bujagali_html.length, more.length].concat(more));",
        "}"
      ].join(''));
      this.recurse(body.slice(match.index + match[0].length));
      this.insertJavascriptCode("return __bujagali_html.join('');};");
    },
    '#import': function importer(body) {
      this.imports.push(body);
    },
    '#extends': function extend(body) {
      if (this.extend) {
        throw new Error("Can only extend from one template");
      }
      this.extend = body;
    }
  };

  // Stick this somewhere where users can get to it
  if (typeof module != 'undefined') {
    module.exports.Parser = Parser;
  }
  if (typeof Bujagali != 'undefined') {
    Bujagali.Parser = Parser;
  }
})();
