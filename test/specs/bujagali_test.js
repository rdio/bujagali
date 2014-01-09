(function() {
  describe('Bujagali', function() {
    describe('Utils', function() {
      it('parses ISO date without timezone', function() {
        var d = Bujagali.Utils.date('1999-01-03', true);
        expect(d instanceof Date).toBe(true);
        expect(d.getFullYear()).toBe(1999);
        expect(d.getMonth()).toBe(0);
        expect(d.getDate()).toBe(3);
      });
      it('parses the unix epoch correctly', function() {
        var d = Bujagali.Utils.date('1970-01-01', true);
        expect(d instanceof Date).toBe(true);
        expect(d.getFullYear()).toBe(1970);
      });
    });
    it('generates a list of classes properly', function() {
      var u = Bujagali.Utils;
      expect(u.classes({
        one: true,
        two: false,
        three: true
      })).toBe('one three');
      expect(u.classes({
        one: false,
        two: false,
        three: false
      })).toBe('');
      expect(u.classes({
        one: true,
        two: false,
        three: true
      }, true)).toBe('class="one three"');
      expect(u.classes({
        one: false,
        two: false,
        three: false
      }, true)).toBe('');
    });
  });

}).call(this);
