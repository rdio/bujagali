#!/usr/bin/env python
import httplib
import sys

if len(sys.argv) < 2:
    print "please provide a port to ping"
    exit(-1)

message = "hello world!"

script = """
var message = "%s";
response.writeHead(200, {
    'Content-Length': message.length,
    'Content-Type': 'text/plain'
});
response.end(message, 'utf8');
""" % message

c = httplib.HTTPConnection('localhost:%d' % int(sys.argv[1]))
c.request('POST', '/', script)
r = c.getresponse()
output = r.read()
c.close()

print output
assert(output == message);

