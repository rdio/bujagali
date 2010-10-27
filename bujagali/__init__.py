'''Bujagali - a simple template system for JavaScript
The basic principle is to compile templates on the server-side to JS functions,
then load them lazily on the client to render JSON data.


There are two ways to include external code :
  #import template // must be at the top
  #extends template // must be at the top, but after any imports

There are five kinds of template tags:
  {{ js-variable }}
  {% js-code %}
  {# comment #}
  {$ block-name $}
  {= macro =}
'''

import re
import os
import hashlib
import subprocess
import logging

try:
  import json
except ImportError:
  import simplejson as json

try:
  import cjson
except ImportError:
  cjson = None

_compile_re = re.compile(r'{((?P<stache>{)|(?P<kind>[%!=#$]))(?P<body>.+?)(?(kind)(?P=kind))(?(stache)})}', re.DOTALL)

def jsonify(data):
  if cjson:
    return cjson.encode(data)
  else:
    return json.dumps(data)

# assumption here: template versions don't change while server is running
_template_versions = {}

class FunctionBuilder(object):
  def __init__(self, root):
    self.root = root
    self.f = ''
    self.literals = []
    self.appends = []
    self.dependencies = {}
    self.preamble = """
      function(ctx, args) {
        var self = this;
        var done = function(post) {
          self.done(post);
          done = function() {};
        };
        function emit(more) {
          Array.prototype.splice.apply(
            self.markup,
            [self.markup.length, more.length].concat(more));
        }
    """
    self.frontWrap = ''
    self.backWrap = ''
    self.closer = '\n}\n'

  def insert_imports(self, code):
    toRemove = []
    lines = code.splitlines()
    seenExport = False
    for line in lines:
      if line.startswith('#import'):
        if seenExport:
          raise Exception("Extends must come after imports")
        toRemove.append(line)
        name = line.lstrip('#import').strip()
        monad = '__bg' + hashlib.md5(name).hexdigest()
        bg = Bujagali(name, self.root)
        self.dependencies[name] = bg.version
        self.dependencies.update(bg.dependencies)
        self.frontWrap = """
          var %(monad)s = new self.ctor('%(name)s', self.context, self.root);
          %(monad)s.load();
          %(wrap)s
          %(monad)s.render(self.context, function() {
          """ % { 'name': name, 'wrap': self.frontWrap, 'monad': monad }
        self.backWrap = " }); " + self.backWrap
      elif line.startswith('#extends'):
        seenExport = True
        toRemove.append(line)
        name = line.lstrip('#extends').strip()
        bg = Bujagali(name, self.root)
        bg.compile()
        self.dependencies[name] = bg.version
        self.dependencies.update(bg.dependencies)
        self.add_js_code(bg.function_builder.frontWrap + bg.function_builder.f)
        self.backWrap = bg.function_builder.backWrap + self.backWrap
      elif line:
        break

    for line in toRemove:
      lines.remove(line)

    return '\n'.join(lines)

  def compile(self, code):
    pos = 0
    code = self.insert_imports(code)
    for m in _compile_re.finditer(code):
      self.add_literal(code[pos:m.start()])
      body = m.groupdict()['body']
      kind = m.groupdict().get('kind')
      stache = m.groupdict().get('stache')
      if stache:
        self.add_js_variable(body)
      elif kind == '%':
        self.add_js_code(body)
      elif kind == '#':
        pass # do nothing for comments and they'll disappear from the output
      elif kind == '$':
        body = body.strip()
        self.add_js_code(body + '();')
      elif kind == '=':
        body = body.strip()
        name, subCode = re.split('\n', body, 1)
        name, args = re.match('(.*)(\(.*\))', name).groups()
        self.add_js_code("""
          Bujagali.helpers['%s'] = function%s {
            var __bujagali_html = [];
            function emit(more) {
              Array.prototype.splice.apply(
                __bujagali_html,
                [__bujagali_html.length, more.length].concat(more));
            }
            %s
            return __bujagali_html.join('');
          };""" % (name, args, self.compile_sub_block(subCode)[0]))
      pos = m.end()
    self.add_literal(code[pos:])

  def append(self, s):
    self.f = self.f + s
  def compile_sub_block(self, code):
    compiled = FunctionBuilder(self.root)
    compiled.compile(code)
    compiled.collapse_literals()
    compiled.process_appends()
    return compiled.f, compiled.dependencies
  def add_literal(self, literal):
    # maintain the spaces if there's content, remove if it's JUST whitespace
    stripped = literal.strip()
    if stripped:
      self.literals.append(literal)
  def collapse_literals(self):
    if len(self.literals) > 0:
      self.appends.append(`''.join(self.literals)`)
      self.literals = []
  def add_js_variable(self, js):
    self.collapse_literals()
    self.process_appends()
    self.appends.append('(' + js + ')')
  def process_appends(self):
    self.collapse_literals()
    if len(self.appends) > 0:
      #self.append(" emit([" + ','.join(self.appends) + '].join(""));')
      self.append(' emit([' + ','.join(self.appends) + ']);')
      self.appends = []
  def add_js_code(self, code):
    self.process_appends()
    self.append(code + '\n')
  def __str__(self):
    self.process_appends()
    assert len(self.literals) == 0
    assert len(self.appends) == 0
    return self.preamble + self.frontWrap + self.f + ' done(); ' + self.backWrap + self.closer

class Bujagali(object):

  _version = None
  _dependencies = None

  def __init__(self, template, root="./", exports = {}, jsRoot='./', mixins=[]):
    self.template = template
    self.root = root
    self.path = os.path.join(self.root, self.template)
    self.exports = exports
    self.mixins = mixins
    self.jsRoot = jsRoot

  def compile(self):
    with open(self.path) as f:
      code = f.read()
    self.function_builder = FunctionBuilder(self.root)
    try:
      self.function_builder.compile(code)
    except Exception, e:
      logging.error('could not compile ' + self.template)
      raise e
    self._version = self.hash(str(self.function_builder))
    self._dependencies = self.function_builder.dependencies
    self._dependencies[self.template] = self._version
    return str(self.function_builder)

  def get_version(self):
    if not self._version:
      self._version = self.hash(self.compile())
    return self._version

  version = property(get_version)

  def get_dependencies(self):
    if not self._dependencies:
      self.compile()
    return self._dependencies

  dependencies = property(get_dependencies)

  def hash(self, contents):
    return hashlib.md5(contents).hexdigest()

  def generate(self):
    compiled = self.compile()
    return """
      Bujagali.fxns['%(name)s'] = %(function)s;
      Bujagali.fxns['%(name)s'].version = "%(hash)s";
      Bujagali.fxnLoaded('%(name)s');
      """ % { 'name': self.template, 'function': compiled, 'hash': self.version }

  def get_html(self, context, port):
    """
    Given a context, returns html. Pass in the port that the bujagali_server.js
    is running on.

    Context can be a dict or a JSON string.
    """
    if type(context) == dict:
      context = jsonify(context)

    input = ["""
    _ = require('%s')._;
    Bujagali = require('%s');
    fs = require('fs');
    """ % (
      os.path.join(self.jsRoot, 'underscore'),
      os.path.join(self.jsRoot, 'bujagali'))]

    for name, value in self.exports.iteritems():
      input.append('%s = %s;' % (name, jsonify(value)))

    for path in self.mixins:
      input.append("""
        eval(fs.readFileSync('%s', 'utf8'));
      """ % (os.path.join(self.jsRoot, path)))

    input.append("""
    %s;
    m = new Bujagali.Monad('%s', %s, '%s');
    m.callback = function(data, markup) {
      response.writeHead(200, {
        'Content-Length': markup.length,
        'Content-Type': 'text/html'
      });
      response.end(markup, 'utf8');
    };
    m.exec();""" % (
      self.generate(), self.template, context, self.root))
    input = '\n'.join(input)
    import httplib, codecs
    c = httplib.HTTPConnection('localhost:%d' % port)
    c.request('POST', '/', input)
    r = c.getresponse()
    output = r.read()
    c.close()

    decoder = codecs.getdecoder('utf8')
    output, length = decoder(output, 'replace')

    if r.status != 200:
      logging.error(output)
      return ''

    return output

def create_context(template, data, root):
  return {
    'data': data,
    'template': template,
    'deps': get_template_deps(template, root)
  }

def get_template_deps(name, root):
  global _template_versions
  if not _template_versions.has_key(name):
    return Bujagali(name, root).dependencies
  return _template_versions[name]

def set_template_deps(deps):
  global _template_versions
  """
  If you precalculated the template versions somewhere, you can just load them
  up beforehand and not have the overhead of calculating them the first time
  they're used. Just pass the table in here.
  """
  _template_versions = deps
