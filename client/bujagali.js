/*jslint evil:true */
/*globals document load fs $ console exports _ require Backbone */

/**
 * Bujagali
 *
 * The namespace that holds all the Bujagali magic. You may want to alias it
 * to something shorter and easier to type.
 **/
var Bujagali = (function() {

  var root = this;

  var SCRIPT_BASE_URL = '/';
  var VERIFY_VERSIONS = true;

  /* ECMAScript 5!! */
  if (!Object.create) {
    Object.create = function(prototype) {
      function p() {}
      p.prototype = prototype;
      return new p();
    };
  }

  var headEl = (typeof document != 'undefined') ?
    document.getElementsByTagName("head")[0] :
    null;

  function doVersionsMatch(v1, v2) {
    return v1 != v2;
  }

  var needNewVersion = doVersionsMatch;

  if (root.__testing__) {
    needNewVersion = function() { return false; };
  }

  /* escaped and unescaped version of special characters */
  var specialCharacters = {
    amp: {
      escaped: '&amp;',
      unescaped: '&'
    },
    lt: {
      escaped: '&lt;',
      unescaped: '<'
    },
    gt: {
      escaped: '&gt;',
      unescaped: '>'
    },
    apos: {
      escaped: '&#39;',
      unescaped: '\''
    },
    quot: {
      escaped: '&quot;',
      unescaped: '"'
    },
    hellip: {
      escaped: '&hellip;',
      unescaped: '…'
    }
  };

  /* RegExps for escaped and unescaped versions of special characters */
  var specialCharactersRe = {};
  _.each(specialCharacters, function(value, key) {
    specialCharactersRe[key] = {
      escaped: RegExp(value.escaped, 'g'),
      unescaped: RegExp(value.unescaped, 'g')
    };
  });

  /* iso regex */
  var isoRe = /([0-9]{4})(-([0-9]{2})(-([0-9]{2})(T([0-9]{2}):([0-9]{2})(:([0-9]{2})(\.([0-9]+))?)?(Z|(([\-+])([0-9]{2}):([0-9]{2})))?)?)?)?/i;

  /* urlize regular expression */
  var urlMatcher = /(https?:\/\/)?([0-9A-z][0-9A-z\-\.]*)[0-9A-z](\.com\.br|\.com|\.org|\.net|\.edu|\.mil|\.gov|\.cc|\.me|\.cn|\.ly|\.io|\.fm|\.co|\.uk|\.ca|\.be|\.jp|\.pe|\.kr|\.lu|\.us)(\/?[0-9A-z\-_\.\?=&#\/;%:+(]+[0-9A-z\/])?/gi;

  var newLineRe = /\n/g;

  /**
   * Bujagali.Utils
   *
   * Utility functions made available to your templates.
   **/
  var utils = {
    /**
     * Bujagali.Utils.enrich(s) -> string
     * - s (string): A string to enrich
     *
     * This function takes a string, escapes it, urlizes it, and converts
     * newlines into <br /> tags. One stop shopping for spitting out user
     * provided content.
     *
     * Returns the enriched string.
     **/
    enrich: function(s) {
      s = utils.escape(s);
      s = utils.urlize(s);
      s = s.replace(newLineRe, '<br />');
      return s;
    },

    /**
     * Bujagali.Utils.urlize(s[, dontReplace]) -> string
     * - s (String): The string to urlize
     * - dontReplace (Array): An array of urls to ignore when urlizing.
     *
     * Looks for urls in `s` and replaces them with anchor tags. Returns the
     * new string.
     *
     * *Hint:*
     * If using this in combination with `Bujagali.Utils.escape`, you
     * should do this afterwards.
     **/
    urlize: function(s, dontReplace) {
      var matches = s.match(urlMatcher);
      if (!matches) { return s; }
      var output = '';
      var end;
      _.each(matches, function(link) {
        var replace = true;
        var prefix = 'http://';

        /* check against a list of safe urls. If it matches,
         * we don't want to urlize that particular url
         */
        if (dontReplace) {
          _.each(dontReplace, function(safe) {
            if (link.search(safe) != -1) {
              replace = false;
            }
          });
        }
        if (replace) {
          if (link.slice(0,4) == 'http') {
            prefix = '';
          }
          end = s.indexOf(link);
          output += s.slice(0, end);
          output += [
            '<a target="_blank" title = "', link, '" href="',
            prefix, link, '">',
            utils.truncate(link, 80), '</a>'
          ].join('');
          s = s.slice(end + link.length);
        }
      });
      output += s; // get the tail
      return output;
    },

    /**
     * Bujagali.Utils.randomID() -> number
     *
     * Returns a random integer between 0 and 10000000
     **/
    randomID: function() {
      return Math.floor(Math.random() * 10000000);
    },

    /**
     * Bujagali.Utils.date(isoDate) -> Date
     * - isoDate (string): An iso date string
     *
     * Take an iso date string and returns a JavaScript date object representing
     * the same date and time.
     **/
    date: function(isoDate, ignoreTimezone) {
      if (!isoDate) { return isoDate; }

      var utc = utils.parseISODate(isoDate, ignoreTimezone);
      if (utc === null) {
        return null;
      }
      var d = new Date();
      d.setTime(utc);
      return d;
    },

    // we should refactor the next two fns to be more consistent
    parseISODate: function(string, dontAdjustTimezone) {
      if (!string) { return null; }

      var d = string.match(isoRe);
      if (!d) {
        return null;
      }
      var offset = 0;
      var date = new Date(d[1], 0, 1);

      if (d[3]) { date.setMonth(d[3] - 1); }
      if (d[5]) { date.setDate(d[5]); }
      if (d[7]) { date.setHours(d[7]); }
      if (d[8]) { date.setMinutes(d[8]); }
      if (d[10]) { date.setSeconds(d[10]); }
      if (d[12]) { date.setMilliseconds(Number("0." + d[12]) * 1000); }
      if (d[14]) {
        offset = (Number(d[16]) * 60) + Number(d[17]);
        offset *= ((d[15] == '-') ? 1 : -1);
      }

      if (!dontAdjustTimezone) {
        offset -= date.getTimezoneOffset();
      }
      return (Number(date) + (offset * 60 * 1000));
    },

    toISOString: function(date) {
      // Date.prototype.toISOString is undefined for IE < 9
      if (_.isString(date)) {
        date = utils.date(date);
      }

      // stolen from https://gist.github.com/1044533/6f0b6ee5dd2b23277701e394c4e31f5be0c3f2b1
      // - and then modified so it actually works

      var regexStr = (
        1e3 // Insert a leading zero as padding for months < 10
        -~date.getUTCMonth() // Months start at 0, so increment it by one
        *10 // Insert a trailing zero as padding for days < 10
        +date.toUTCString().replace(/^[A-z]{3}, /, '') // Can be "1 Jan 1970 00:00:00 GMT" or "Thu, 01 Jan 1970 00:00:00 GMT" (or "Thu, 1 Jan 1970 00:00:00 UTC"!)
        +1e3+date/1 // Append the millis, add 1000 to handle timestamps <= 999
        // The resulting String for new Date(0) will be:
        // "-1010 Thu, 01 Jan 1970 00:00:00 GMT1000" or
        // "-10101 Jan 1970 00:00:00 GMT1000" (IE)
      );

      return regexStr.replace(
        // The two digits after the leading '-1' contain the month
        // The next two digits (at whatever location) contain the day
        // The last three chars are the milliseconds
        /1(..).*?(\d\d)\D+(\d+).(\S+).*(...)/,
       '$3-$1-$2T$4.$5Z'
      );
    },


    /**
     * Bujagali.Utils.truncate(s, length) -> string
     * - s (string): The string to truncate
     * - length (number): Where to truncate the string
     *
     * Takes a string and returns a string that is the length specified, plus
     * an ellipsis if the original string was longer than the length. If the
     * original string's length is less that `length`, just return the original
     * string.
     **/
    truncate: function(s, length, escape) {
      if (s.length > length) {
        s = s.slice(0, length - 1) + specialCharacters.hellip.unescaped;
      }
      return escape ? utils.escape(s) : s;
    },

    /**
     * Bujagali.Utils.capitalize(s) -> string
     * - s (string): The string to capitalize
     *
     * Capitalizes the first letter of every word in the
     * string and returns the result.
     **/
    capitalize: function(s) {
      return _.map(s.split(' '), function(sub) {
        return sub.charAt(0).toUpperCase() + sub.slice(1);
      }).join(' ');
    },

    /**
     * Bujagali.Utils.escape(str) -> string
     * - str (String): The string to escape.
     *
     * Takes the input string and replaces potentially dangerous text with
     * HTML entitites. For instance "<script>" becomes "&lt;script&gt;"
     *
     * Returns the escaped string.
     **/
    escape: function(str) {
      if (!str || !_.isString(str)) {
        return str;
      }

      _.each(specialCharacters, function(character, key) {
        str = str.replace(specialCharactersRe[key].unescaped, character.escaped);
      });

      return str;
    },

    /**
     * Bujagali.Utils.deEscape(str) -> string
     * - str (String): The string to deEscape
     *
     * Reverses Bujagali.Utils.escape
     *
     * Returns the de-escaped string.
     **/
    deEscape: function(str) {
      /* removes escaping performed by django filter 'escape' */
      if(!str) { return ''; }

      _.each(specialCharacters, function(character, key) {
        str = str.replace(specialCharactersRe[key].escaped, character.unescaped);
      });

      return str;
    },

    /**
     * Bujagali.Utils.classes(options, includeClassAttribute) -> string
     * - options (Object): An object containing className/condition key/value pairs
     * - includeClassAttribute (Boolean): If true, include the class attribute declaration
     *
     * Returns a string containing a list of keys whose values evaluate to `true`.
     * If `includeClassAttribute` is `true`, the list is wrapped with 'class=""'
     **/
    classes: function(options, includeClassAttribute) {
      var begin = '';
      var end = '';
      var classes = [];

      if (includeClassAttribute) {
        begin = 'class="';
        end = '"';
      }

      _.each(options, function(condition, className) {
        if (condition) {
          classes.push(className);
        }
      });

      if (!classes.length) {
        return '';
      }

      return begin + classes.join(' ') + end;
    }
  };

  var helpers = Object.create(utils);

  /**
   * class Bujagali.Monad
   *
   * A Monad provides a binding between some data and a template.
   *
   * Monads are templates that are associated with data. They may have been
   * executed or they may be pending execution. This is the class that does the
   * magic: when you refer to `self` in a template, you are referring to your
   * Monad
   **/

  /**
   * new Bujagali.Monad(name[, context][, root])
   * - name (String): The name of the template to render
   * - context (Object): The context that provides the data of the
   *   template to render.
   * - root (String): The path to the root of the templates directory. If you
   *   are running in a browser, this is usually unnecessary.
   **/
  function Monad(name, context, root) {
    this.name = name;
    this.root = root || SCRIPT_BASE_URL;
    this.afterRenderCalls = {};

    if (context) {
      this.context = context;
    }
  }

  var module = {
    fxns: {}, // The actual template functions.
    helpers: helpers, // macros

    /**
     * Bujagali.postProcessors -> Object
     *
     * This is an object that maps post processing actions to functions. In
     * a template you can do something like:
     *
     *    self.afterRender('myPostProcessor', myData);
     *
     * After the render is complete, the function identified by
     * `Bujagali.postProcessors.myPostProcessor` will be called and passed the
     * data. If `afterRender` is called multiple times during the course of
     * the rendering process, the post processing function will receive as
     * many arguments as times the function was called.
     **/
    postProcessors: {},

    /**
     * Bujagali.render(name[, args]) -> Bujagali.Monad
     * - name (String): The name of a template to render.
     *
     *   This will create a new `Bujagali.Monad` and call render on it,
     *   passing the remaining arguments (after the name) to the
     *   `Bujagali.Monad.render` function. It is a shortcut function.
     **/
    render: function(name) {
      var inst = new Monad(name);
      inst.render.apply(inst, _.tail(arguments));
      return inst;
    },

    /**
     * Bujagali.renderMacro(name, cb[, args]) -> undefined
     * - name (String): The name of the macro to render
     * - cb (function): A function to call with the results of the macro.
     *
     *  This allows you to call Bujagali macros from outside of a template. This
     *  is useful when you want to update a list that was originally rendered
     *  with a particular macro from within your JavaScript program.
     **/
    renderMacro: function(name, cb) {
      var shell = new Monad();
      var markup = shell[name].apply(shell, _.tail(arguments, 2));
      cb(markup);
      shell.doAfterRender();
    },
    /**
     * Bujagali.mixin(obj) -> undefined
     * - obj (Object): A new object to make available to templates.
     *
     * The properties provided in `obj` will be available under `Bujagali.Utils`
     * as well as in templates via `self`.
     **/
    mixin: function(obj) {
      _.extend(utils, obj);
    },
    setBaseUrl: function(url) {
      SCRIPT_BASE_URL = url;
    },
    Utils: utils,
    Monad: Monad
  };

  Monad.prototype = Object.create(helpers);
  _.extend(Monad.prototype, {
    ctor: Monad, // for subtemplates, and we overrode the proto one

    /**
     * Bujagali.Monad#render(context, callback[, args][, markup]) -> undefined
     * - context (Object): The data provided to the template
     * - callback (function): The function to be called after render is
     *   complete
     * - args (object): Any additional information you want to make available
     *   to the template
     * - markup (Array): An optional array to write the resulting markup
     *   into. This allows you to embed templates inside other templates.
     *
     * This is the function that does the magic. It loads the template and then
     * executes it with the provided context.
     *
     * The context must conform to a particular format:
     *
     *     {
     *         data: {
     *           // Object representing data used in the template. This is
     *           // available in the template as "ctx"
     *         }
     *     }
     *
     * However, this should be taken care of you on the server side. Refer to
     * that documentation for more details.
     *
     * The `callback` is a function with the signature:
     *
     *     function callback(data, markup, args);
     *
     * where `data` is the `context.data`, `markup` is the result of the template
     * rendering, and `args` is the same `args` the user passed into
     * Bujagali.Monad#render.
     *
     * `args` is passed back to the callback function and is never used by
     * `Bujagali.Monad` itself.
     **/
    render: function(context, callback, args, markup) {

      // save our state for execution
      this.context = context;
      this.callback = callback;
      this.args = args;

      var template = module.fxns[this.name];
      if (template) {
        this.exec(markup);
      } else {
        throw new Error("Template " + this.name + " does not exist.");
      }
    },

    renderOnce: function(context, callback, args) {
      var template = module.fxns[this.name];
      if (template && template.rendered) {
        // we've rendered this already, just call back with the current data
        callback(context.data, null, args);
      }
      else {
        // we haven't rendered once, do the normal render thing
        this.render(context, callback, args);
      }
    },

    /**
     * Bujagali.Monad#exec([markup]) -> undefined
     * - markup (Array): Optional array to place the markup into.
     *
     * Executes the template with the associated data.
     *
     * You probably won't need to use this function. Look at
     * Bujagali.Monad#render instead.
     **/
    exec: function(markup) {
      var template = module.fxns[this.name];
      this.markup = markup || [];
      /* this.startTime = (new Date()).valueOf(); */
      template.call(this, this.context.data, this.args);
    },

    done: function(post) {
      /* timing that works in IE $('body').append('<div style="color:white;">render for ' + this.name + ' took ' + (((new Date()).valueOf() - this.startTime)) + 'ms </div>'); */
      var markup = this.markup.join('');
      this.callback(this.context.data, markup, this.args);
      if(post) { post(); }
      this.doAfterRender();
      module.fxns[this.name].rendered = true;
      this.markup = []; // don't retain strings
    },

    doAfterRender: function() {
      var self = this;
      _.each(self.afterRenderCalls, function(args, key) {
        var f = module.postProcessors[key];
        if (f) {
          f.apply(self, args);
        }
      });
    },

    /**
     * Bujagali.Monad#afterRender(key, arg) -> undefined
     * - key (String): The after render action to be called.
     * - arg (Object): Arbitrary data to pass to the after render funciton.
     *
     * Call one of the functions in `Bujagali.postProcessors` after we're done
     * rendering the Monad. Will be passed `arg`.
     **/
    afterRender: function(key, arg) {
      var argList = this.afterRenderCalls[key];
      if (argList) {
        argList.push(arg);
      }
      else {
        this.afterRenderCalls[key] = [arg];
      }
    },

    _pending: function() {
      var queue = pendingExec[this.name];
      if (!queue) {
        pendingExec[this.name] = queue = [];
      }
      queue.push(this);
    },

    noBlockFound: {},
    _getBlock: function(blockProviders, blockName) {
      var self = this;
      var provider = _.find(blockProviders, function(provider) {
        return provider(blockName) != self.noBlockFound;
      });
      if (provider) {
        return provider(blockName);
      }
    }
  });

  if (root.Backbone) {
    /**
     * class Bujagali.View
     *
     * When backbone.js is included, we have a special View that
     * uses bujagali, but interacts with the rest of the system in
     * a backbone-like way
     *
     * You should refer to [Backbone.View][1] for additional information.
     *
     * [1]: http://documentcloud.github.com/backbone/#View
     **/
    module.View = Backbone.View.extend({
      initialize: function(options) {
        options = options || {};
        var template = options.template || this.template;

        this.children = [];
        if (template) {
          this.monad = new module.Monad(template);
          this.monad.view = this;
        }
      },

      /**
       * Bujagali.View.render(context, callback) -> undefined
       * - context (Object): Dependencies and data for the template
       * - callback (Function): Function to call when render is complete
       *
       * This renders the template for the view with the `context` object
       * provided. `context` should be in the same format as is required
       * for `Bujagali.render`.
       *
       * `callback` will be called when rendering is finished. Arguments
       * to the callback are the `context.data` property or `null` if a
       * template is not provided.
       *
       **/
      render: function(context, callback) {
        var self = this;
        // Check if we have a template to render, else just return ourselves
        if (!self.monad) {
          $(self.el).empty();
          callback();
          return self;
        }
        self.monad.render(context, function(data, markup) {
          $(self.el).html(markup);
          callback(data);
        }, this.options);
        return self;
      }
    });

    module.MacroView = Backbone.View.extend({
      initialize: function(name) {
        this.name = name;
      },
      render: function(callback) {
        var self = this;
        var renderArgs = [self.name, function(markup) {
          $(self.el).children().remove();
          $(self.el).html(markup);
          self.trigger('render');
          if (self.onRendered) {
            self.onRendered();
          }
          if (callback && _.isFunction(callback)) {
            callback();
          }
        }, self].concat(_.toArray(arguments));
        module.renderMacro.apply(self, renderArgs);
      }
    });
  }

  return module;
})();

/* make this load in node.js */
(function() {
  if (typeof exports != 'undefined') {
    var key;
    for (key in Bujagali) {
      if (Bujagali.hasOwnProperty(key)) {
        exports[key] = Bujagali[key];
      }
    }
  }
})();
