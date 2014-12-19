process.env.NO_DEPRECATION = 'file-send';

var assert = require('assert');
var fs = require('fs');
var http = require('http');
var path = require('path');
var request = require('supertest');
var Send = require('../send');
var should = require('should');
var debug = require('../lib/debug');
var util = require('../lib/util');

debug.verbose = true;
debug('File-Send')('%s', 'This is a debug test o(^_^)o');
debug.verbose = false;
util.isType(NaN, 'nan');

// test server
var dateRegExp = /^\w{3}, \d+ \w+ \d+ \d+:\d+:\d+ \w+$/;
var fixtures = path.join(__dirname, 'fixtures');
var send = Send(fixtures);
var app = http.createServer(function (req, res){
  function directory(){
    this.error(403);
  }

  function error(err){
    res.statusCode = err.status;
    res.end(http.STATUS_CODES[err.status]);
  }

  send.use(req, res)
    .on('directory', directory)
    .on('error', error)
    .transfer();
});

describe('Send.mime', function (){
  it('should be exposed', function (){
    assert(Send.mime);
  })
});

describe('Send(root)', function (){
  it('should stream the file contents', function (done){
    request(app)
      .get('/name.txt')
      .expect('Content-Length', '4')
      .expect(200, 'tobi', done);
  });

  it('should decode the given path as a URI', function (done){
    request(app)
      .get('/some%20thing.txt')
      .expect(200, 'hey', done);
  });

  it('should serve files with dots in name', function (done){
    request(app)
      .get('/do..ts.txt')
      .expect(200, '...', done);
  });

  it('should support url has query string', function (done){
    request(app)
      .get('/name.txt?query=file')
      .expect('Content-Length', '4')
      .expect(200, 'tobi', done);
  });

  it('should only support http method "GET" and "HEAD"', function (done){
    request(app)
      .post('/name.txt')
      .expect(405, 'Method Not Allowed', done);
  });

  it('should treat a malformed URI as a bad request', function (done){
    request(app)
      .get('/some%99thing.txt')
      .expect(400, 'Bad Request', done);
  });

  it('should 400 on NULL bytes', function (done){
    request(app)
      .get('/some%00thing.txt')
      .expect(400, 'Bad Request', done);
  });

  it('should treat an ENAMETOOLONG as a 404', function (done){
    var path = (new Array(100)).join('foobar');
    request(app)
      .get('/' + path)
      .expect(404, done);
  });

  it('should handle headers already sent error', function (done){
    var app = http.createServer(function (req, res){
      res.write('0 - ');
      send.use(req, res)
        .transfer();
    });
    request(app)
      .get('/nums')
      .expect(200, '0 - {"status":500,"message":"Can\'t set headers after they are sent"}', done);
  });

  it('should support HEAD', function (done){
    request(app)
      .head('/name.txt')
      .expect('Content-Length', '4')
      .expect(200, '', done);
  });

  it('should add an ETag header field', function (done){
    request(app)
      .get('/name.txt')
      .expect('etag', /^"\S{22}=="$/)
      .end(done);
  });

  it('should add a Date header field', function (done){
    request(app)
      .get('/name.txt')
      .expect('date', dateRegExp, done);
  });

  it('should add a Last-Modified header field', function (done){
    request(app)
      .get('/name.txt')
      .expect('last-modified', dateRegExp, done);
  });

  it('should add a Accept-Ranges header field', function (done){
    request(app)
      .get('/name.txt')
      .expect('Accept-Ranges', 'bytes', done);
  });

  it('should 404 if the file does not exist', function (done){
    request(app)
      .get('/meow')
      .expect(404, 'Not Found', done);
  });

  it('should 301 if the directory exists', function (done){
    request(app)
      .get('/pets')
      .expect('Location', '/pets/')
      .expect(301, 'Redirecting to <a href="/pets/">/pets/</a>', done)
  });

  it('should 404 if the directory not exists', function (done){
    request(app)
      .get('/what/')
      .expect(404, 'Not Found', done);
  });

  it('should not override content-type', function (done){
    var app = http.createServer(function (req, res){
      send.use(req, res)
        .on('headers', function (res){
          res.setHeader('Content-Type', 'application/x-custom');
        })
        .transfer();
    });
    request(app)
      .get('/nums')
      .expect('Content-Type', 'application/x-custom', done);
  });

  it('should set Content-Type via mime map', function (done){
    request(app)
      .get('/name.txt')
      .expect('Content-Type', 'text/plain; charset=UTF-8')
      .expect(200, function (err){
        if (err) return done(err);
        request(app)
          .get('/tobi.html')
          .expect('Content-Type', 'text/html; charset=UTF-8')
          .expect(200, done);
      });
  });

  it('should 404 if file disappears after stat, before open', function (done){
    var app = http.createServer(function (req, res){
      send.use(req, res)
        .on('file', function (){
          // simulate file ENOENT after on open, after stat
          var fn = this.send;
          this.send = function (path, stat){
            var self = this;

            fs.stat(path += '__xxx_no_exist', function (){
              fn.call(self, path, stat);
            });
          };
        })
        .transfer();
    });

    request(app)
      .get('/name.txt')
      .expect(404, done);
  });

  it('should 500 on file stream error', function (done){
    var app = http.createServer(function (req, res){
      send.use(req, res)
        .on('stream', function (stream){
          // simulate file error
          process.nextTick(function (){
            stream.emit('error', new Error('boom!'));
          });
        })
        .transfer();
    });

    request(app)
      .get('/name.txt')
      .expect(500, done);
  });

  describe('"headers" event', function (){
    var args;
    var fn;
    var headers;
    var server;
    before(function (){
      server = http.createServer(function (req, res){
        send.use(req, res)
          .on('headers', function (){
            args = arguments;
            headers = true;
            fn && fn.apply(this, arguments)
          })
          .transfer();
      });
    });
    beforeEach(function (){
      args = undefined;
      fn = undefined;
      headers = false;
    });

    it('should fire when sending file', function (done){
      request(server)
        .get('/nums')
        .expect(200, '123456789', function (err){
          if (err) return done(err);
          headers.should.be.true;
          done();
        });
    });

    it('should not fire on 404', function (done){
      request(server)
        .get('/bogus')
        .expect(404, function (err, res){
          if (err) return done(err);
          headers.should.be.false;
          done();
        });
    });

    it('should fire on index', function (done){
      request(server)
        .get('/pets/')
        .expect(200, /tobi/, function (err){
          if (err) return done(err);
          headers.should.be.true;
          done();
        });
    });

    it('should not fire on redirect', function (done){
      request(server)
        .get('/pets')
        .expect(301, function (err){
          if (err) return done(err);
          headers.should.be.false;
          done();
        });
    });

    it('should provide path', function (done){
      request(server)
        .get('/nums')
        .expect(200, '123456789', function (err){
          if (err) return done(err);
          headers.should.be.true;
          args[1].should.endWith('nums');
          done();
        });
    });

    it('should provide stat', function (done){
      request(server)
        .get('/nums')
        .expect(200, '123456789', function (err){
          if (err) return done(err);
          headers.should.be.true;
          args[2].should.have.property('mtime');
          done();
        });
    });

    it('should allow altering headers', function (done){
      fn = function (res, path, stat){
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Content-Type', 'text/x-custom');
        res.setHeader('ETag', 'W/"everything"');
        res.setHeader('X-Created', stat.ctime.toUTCString());
      };

      request(server)
        .get('/nums')
        .expect('Cache-Control', 'no-cache')
        .expect('Content-Type', 'text/x-custom')
        .expect('ETag', 'W/"everything"')
        .expect('X-Created', dateRegExp)
        .expect(200, '123456789', done);
    });
  });

  describe('when no "directory" listeners are present', function (){
    var server;
    before(function (){
      server = http.createServer(function (req, res){
        send.use(req, res)
          .transfer();
      });
    });

    it('should respond with an HTML redirect', function (done){
      request(server)
        .get('/pets')
        .expect('Location', '/pets/')
        .expect('Content-Type', 'text/html; charset=utf-8')
        .expect(301, 'Redirecting to <a href="/pets/">/pets/</a>', done);
    });
  });

  describe('when no "error" listeners are present', function (){
    it('should respond to errors directly', function (done){
      var app = http.createServer(function (req, res){
        req.url = 'test/fixtures' + req.url;
        send.use(req, res)
          .transfer();
      });

      request(app)
        .get('/foobar')
        .expect(404, 'Not Found', done);
    });
  });

  describe('with conditional get', function (){
    it('should respond with 304 on a match', function (done){
      request(app)
        .get('/name.txt')
        .expect(200, function (err, res){
          if (err) return done(err);
          request(app)
            .get('/name.txt')
            .set('If-None-Match', res.headers.etag)
            .expect(304, function (err, res){
              if (err) return done(err);
              res.headers.should.not.have.property('content-type');
              res.headers.should.not.have.property('content-length');
              done();
            });
        });
    });

    it('should respond with 200 otherwise', function (done){
      request(app)
        .get('/name.txt')
        .expect(200, function (err){
          if (err) return done(err);
          request(app)
            .get('/name.txt')
            .set('If-None-Match', '"123"')
            .expect(200, 'tobi', done);
        });
    });
  });

  describe('with range request', function (){
    it('should support byte ranges', function (done){
      request(app)
        .get('/nums')
        .set('Range', 'bytes=0-4')
        .expect(206, '12345', done);
    });

    it('should be inclusive', function (done){
      request(app)
        .get('/nums')
        .set('Range', 'bytes=0-0')
        .expect(206, '1', done);
    });

    it('should set Content-Range', function (done){
      request(app)
        .get('/nums')
        .set('Range', 'bytes=2-5')
        .expect('Content-Range', 'bytes 2-5/9')
        .expect(206, done);
    });

    it('should support -n', function (done){
      request(app)
        .get('/nums')
        .set('Range', 'bytes=-3')
        .expect(206, '789', done);
    });

    it('should support n-', function (done){
      request(app)
        .get('/nums')
        .set('Range', 'bytes=3-')
        .expect(206, '456789', done);
    });

    it('should respond with 206 "Partial Content"', function (done){
      request(app)
        .get('/nums')
        .set('Range', 'bytes=0-4')
        .expect(206, done);
    });

    it('should set Content-Length to the # of octets transferred', function (done){
      request(app)
        .get('/nums')
        .set('Range', 'bytes=2-3')
        .expect('Content-Length', '2')
        .expect(206, '34', done);
    });

    describe('when last-byte-pos of the range is greater the length', function (){
      it('is taken to be equal to one less than the length', function (done){
        request(app)
          .get('/nums')
          .set('Range', 'bytes=2-50')
          .expect('Content-Range', 'bytes 2-8/9')
          .expect(206, done);
      });

      it('should adapt the Content-Length accordingly', function (done){
        request(app)
          .get('/nums')
          .set('Range', 'bytes=2-50')
          .expect('Content-Length', '7')
          .expect(206, done);
      });
    });

    describe('when the first- byte-pos of the range is greater length', function (){
      it('should respond with 416', function (done){
        app.removeAllListeners('error');
        request(app)
          .get('/nums')
          .set('Range', 'bytes=9-50')
          .expect('Content-Range', 'bytes */9')
          .expect(416, done);
      });
    });

    describe('when syntactically invalid', function (){
      it('should respond with 200 and the entire contents', function (done){
        request(app)
          .get('/nums')
          .set('Range', 'asdf')
          .expect(200, '123456789', done);
      });
    });

    describe('when multiple ranges', function (){
      it('should respond with 206 and the entire contents', function (done){
        request(app)
          .get('/nums')
          .set('Range', 'bytes=1-1,3-')
          .expect('Content-Type', /^multipart\/byteranges; boundary=<[^<>]+>$/)
          .expect(206, done);
      });
    });

    describe('when if-range present', function (){
      it('should respond with parts when etag unchanged', function (done){
        request(app)
          .get('/nums')
          .expect(200, function (err, res){
            if (err) return done(err);

            var etag = res.headers.etag;

            request(app)
              .get('/nums')
              .set('If-Range', etag)
              .set('Range', 'bytes=0-0')
              .expect(206, '1', done);
          });
      });

      it('should respond with 200 when etag changed', function (done){
        request(app)
          .get('/nums')
          .expect(200, function (err, res){
            if (err) return done(err);

            var etag = res.headers.etag.replace(/"(.)/, '"0$1');

            request(app)
              .get('/nums')
              .set('If-Range', etag)
              .set('Range', 'bytes=0-0')
              .expect(200, '123456789', done);
          });
      });

      it('should respond with parts when modified unchanged', function (done){
        request(app)
          .get('/nums')
          .expect(200, function (err, res){
            if (err) return done(err);

            var modified = res.headers['last-modified'];

            request(app)
              .get('/nums')
              .set('If-Range', modified)
              .set('Range', 'bytes=0-0')
              .expect(206, '1', done);
          });
      });

      it('should respond with 200 when modified changed', function (done){
        request(app)
          .get('/nums')
          .expect(200, function (err, res){
            if (err) return done(err);

            var modified = Date.parse(res.headers['last-modified']) - 20000;

            request(app)
              .get('/nums')
              .set('If-Range', new Date(modified).toUTCString())
              .set('Range', 'bytes=0-0')
              .expect(200, '123456789', done);
          });
      });
    });
  });

  describe('send.set("etag", ...)', function (){
    it('should support disabling etag', function (done){
      send.set('etag', false);

      send.get('etag').should.be.false;

      request(app)
        .get('/nums')
        .expect(200, function (err, res){
          if (err) return done(err);
          res.headers.should.not.have.property('etag');
          done();
        });
    });
  });

  describe('send.set("index", ...)', function (){
    it('should be configurable', function (done){
      send.set('index', 'tobi.html');

      send.get('index').should.be.eql(['tobi.html']);

      request(app)
        .get('/')
        .expect(200, '<p>tobi</p>', done);
    });

    it('should support disabling', function (done){
      send.set('index', false);

      send.get('index').should.be.eql([]);

      request(app)
        .get('/pets/')
        .expect(403, done);
    });

    it('should support fallbacks', function (done){
      send.set('index', ['default.htm', 'index.html']);

      send.get('index').should.be.eql(['default.htm', 'index.html']);

      request(app)
        .get('/pets/')
        .expect(200, fs.readFileSync(path.join(fixtures, 'pets', 'index.html'), 'utf8'), done);
    });
  });

  describe('send.set("maxAge", ...)', function (){
    it('should default to 0', function (done){
      send.set('maxAge', undefined);

      send.get('maxAge').should.be.eql(0);

      request(app)
        .get('/name.txt')
        .expect('Cache-Control', 'public, max-age=0', done);
    });

    it('should floor to integer', function (done){
      send.set('maxAge', 1.234);

      send.get('maxAge').should.be.eql(1);

      request(app)
        .get('/name.txt')
        .expect('Cache-Control', 'public, max-age=1', done);
    });

    it('should accept string', function (done){
      send.set('maxAge', '30d');

      send.get('maxAge').should.be.eql(2592000);

      request(app)
        .get('/name.txt')
        .expect('Cache-Control', 'public, max-age=2592000', done);
    });

    it('should max at 1 year', function (done){
      send.set('maxAge', Infinity);

      send.get('maxAge').should.be.eql(31536000);

      request(app)
        .get('/name.txt')
        .expect('Cache-Control', 'public, max-age=31536000', done);
    });
  });

  describe('send.set("root", ...)', function (){
    it('should set root', function (done){
      send.set("root", __dirname + '/fixtures');

      send.get('root').should.be.eql(path.normalize(__dirname + '/fixtures/').replace(/\\/g, '/'));

      request(app)
        .get('/pets/../name.txt')
        .expect(200, 'tobi', done);
    });
  });

  describe('send.set("extensions", ...)', function (){
    it('should set extensions', function (done){
      send.set("extensions", 'txt');

      send.get('extensions').should.be.eql(['txt']);

      request(app)
        .get('/name')
        .expect(200, 'tobi', done);
    });

    it('should support disabling', function (done){
      send.set('extensions', false);

      send.get('extensions').should.be.eql([]);

      request(app)
        .get('/name')
        .expect(404, done);
    });

    it('should support fallbacks', function (done){
      send.set('extensions', ['htm', 'html', 'txt']);

      send.get('extensions').should.be.eql(['htm', 'html', 'txt']);

      request(app)
        .get('/name')
        .expect(200, '<p>tobi</p>', done);
    });
  });

  describe('send.set("lastModified", ...)', function (){
    it('should support disabling last-modified', function (done){
      send.set('lastModified', false);

      send.get('lastModified').should.be.false;

      request(app)
        .get('/nums')
        .expect(200, function (err, res){
          if (err) return done(err);
          res.headers.should.not.have.property('last-modified');
          done();
        });
    });
  });

  describe('send.set("dotFiles", ...)', function (){
    it('should set dotFiles "allow"', function (done){
      send.set('dotFiles', 'allow');

      send.get('dotFiles').should.be.eql('allow');

      request(app)
        .get('/.hidden')
        .expect(200, /secret/, done);
    });

    it('should set dotFiles "deny"', function (done){
      send.set('dotFiles', 'deny');

      send.get('dotFiles').should.be.eql('deny');

      request(app)
        .get('/.hidden')
        .expect(403, done);
    });

    it('should set dotFiles "ignore"', function (done){
      send.set('dotFiles', 'ignore');

      send.get('dotFiles').should.be.eql('ignore');

      request(app)
        .get('/.hidden')
        .expect(404, done);
    });
  });
});

describe('Send(root, options)', function (){
  describe('etag', function (){
    it('should support disabling etags', function (done){
      request(createServer({ etag: false, root: fixtures }))
        .get('/nums')
        .expect(200, function (err, res){
          if (err) return done(err);
          res.headers.should.not.have.property('etag');
          done();
        });
    });
  });

  describe('extensions', function (){
    it('should be not be enabled by default', function (done){
      request(createServer({ root: fixtures }))
        .get('/tobi')
        .expect(404, done);
    });

    it('should be configurable', function (done){
      request(createServer({ extensions: 'txt', root: fixtures }))
        .get('/name')
        .expect(200, 'tobi', done);
    });

    it('should support disabling extensions', function (done){
      request(createServer({ extensions: false, root: fixtures }))
        .get('/name')
        .expect(404, done);
    });

    it('should support fallbacks', function (done){
      request(createServer({ extensions: ['htm', 'html', 'txt'], root: fixtures }))
        .get('/name')
        .expect(200, '<p>tobi</p>', done)
    });

    it('should 404 if nothing found', function (done){
      request(createServer({ extensions: ['htm', 'html', 'txt'], root: fixtures }))
        .get('/bob')
        .expect(404, done);
    });

    it('should skip directories', function (done){
      request(createServer({ extensions: ['file', 'dir'], root: fixtures }))
        .get('/name')
        .expect(404, done);
    });

    it('should not search if file has extension', function (done){
      request(createServer({ extensions: 'html', root: fixtures }))
        .get('/thing.html')
        .expect(404, done);
    });
  });

  describe('lastModified', function (){
    it('should support disabling last-modified', function (done){
      request(createServer({ lastModified: false, root: fixtures }))
        .get('/nums')
        .expect(200, function (err, res){
          if (err) return done(err);
          res.headers.should.not.have.property('last-modified');
          done();
        });
    });
  });

  describe('dotFiles', function (){
    it('should default to "ignore"', function (done){
      request(createServer({ root: fixtures }))
        .get('/.hidden')
        .expect(404, done);
    });

    it('should bad value use default', function (done){
      request(createServer({ dotFiles: 'bogus' }))
        .get('/nums')
        .expect(404, done);
    });

    describe('when "allow"', function (){
      it('should send dotfile', function (done){
        request(createServer({ dotFiles: 'allow', root: fixtures }))
          .get('/.hidden')
          .expect(200, /secret/, done);
      });

      it('should send within dotfile directory', function (done){
        request(createServer({ dotFiles: 'allow', root: fixtures }))
          .get('/.mine/name.txt')
          .expect(200, /tobi/, done);
      });
    });

    describe('when "deny"', function (){
      it('should 403 for dotfile', function (done){
        request(createServer({ dotFiles: 'deny', root: fixtures }))
          .get('/.hidden')
          .expect(403, done);
      });

      it('should 403 for dotfile directory', function (done){
        request(createServer({ dotFiles: 'deny', root: fixtures }))
          .get('/.mine')
          .expect(403, done);
      });

      it('should 403 for dotfile directory with trailing slash', function (done){
        request(createServer({ dotFiles: 'deny', root: fixtures }))
          .get('/.mine/')
          .expect(403, done);
      });

      it('should 403 for file within dotfile directory', function (done){
        request(createServer({ dotFiles: 'deny', root: fixtures }))
          .get('/.mine/name.txt')
          .expect(403, done);
      });

      it('should 403 for non-existent dotfile', function (done){
        request(createServer({ dotFiles: 'deny', root: fixtures }))
          .get('/.nothere')
          .expect(403, done);
      });

      it('should 403 for non-existent dotfile directory', function (done){
        request(createServer({ dotFiles: 'deny', root: fixtures }))
          .get('/.what/name.txt')
          .expect(403, done);
      });

      it('should send files in root dotfile directory', function (done){
        request(createServer({ dotFiles: 'deny', root: path.join(fixtures, '.mine') }))
          .get('/name.txt')
          .expect(200, /tobi/, done);
      });
    });

    describe('when "ignore"', function (){
      it('should 404 for dotfile', function (done){
        request(createServer({ dotFiles: 'ignore', root: fixtures }))
          .get('/.hidden')
          .expect(404, done);
      });

      it('should 404 for dotfile directory', function (done){
        request(createServer({ dotFiles: 'ignore', root: fixtures }))
          .get('/.mine')
          .expect(404, done);
      });

      it('should 404 for dotfile directory with trailing slash', function (done){
        request(createServer({ dotFiles: 'ignore', root: fixtures }))
          .get('/.mine/')
          .expect(404, done);
      });

      it('should 404 for file within dotfile directory', function (done){
        request(createServer({ dotFiles: 'ignore', root: fixtures }))
          .get('/.mine/name.txt')
          .expect(404, done)
      });

      it('should 404 for non-existent dotfile', function (done){
        request(createServer({ dotFiles: 'ignore', root: fixtures }))
          .get('/.nothere')
          .expect(404, done);
      });

      it('should 404 for non-existent dotfile directory', function (done){
        request(createServer({ dotFiles: 'ignore', root: fixtures }))
          .get('/.what/name.txt')
          .expect(404, done);
      });

      it('should send files in root dotfile directory', function (done){
        request(createServer({ dotFiles: 'ignore', root: path.join(fixtures, '.mine') }))
          .get('/name.txt')
          .expect(200, /tobi/, done);
      });
    });
  });

  describe('maxAge', function (){
    it('should default to 0', function (done){
      request(createServer({ root: fixtures }))
        .get('/name.txt')
        .expect('Cache-Control', 'public, max-age=0', done);
    });

    it('should floor to integer', function (done){
      request(createServer({ maxAge: 123.956, root: fixtures }))
        .get('/name.txt')
        .expect('Cache-Control', 'public, max-age=123', done);
    });

    it('should accept string', function (done){
      request(createServer({ maxAge: '30d', root: fixtures }))
        .get('/name.txt')
        .expect('Cache-Control', 'public, max-age=2592000', done);
    });

    it('should max at 1 year', function (done){
      request(createServer({ maxAge: Infinity, root: fixtures }))
        .get('/name.txt')
        .expect('Cache-Control', 'public, max-age=31536000', done);
    });
  });

  describe('index', function (){
    it('should default to index.html', function (done){
      request(createServer({ root: fixtures }))
        .get('/pets/')
        .expect(fs.readFileSync(path.join(fixtures, 'pets', 'index.html'), 'utf8'), done);
    });

    it('should be configurable', function (done){
      request(createServer({ root: fixtures, index: 'tobi.html' }))
        .get('/')
        .expect(200, '<p>tobi</p>', done);
    });

    it('should support disabling', function (done){
      request(createServer({ root: fixtures, index: false }))
        .get('/pets/')
        .expect(403, done);
    });

    it('should support fallbacks', function (done){
      request(createServer({ root: fixtures, index: ['default.htm', 'index.html'] }))
        .get('/pets/')
        .expect(200, fs.readFileSync(path.join(fixtures, 'pets', 'index.html'), 'utf8'), done);
    });

    it('should if no index file found in dir, redirect to dir, and default 403', function (done){
      request(createServer({ root: fixtures, index: 'default.htm' }))
        .get('/pets/')
        .expect(403, done);
    });

    it('should not follow directories', function (done){
      request(createServer({ root: fixtures, index: ['pets', 'name.txt'] }))
        .get('/')
        .expect(200, 'tobi', done);
    });
  });

  describe('root', function (){
    describe('when given', function (){
      it('should join root', function (done){
        request(createServer({ root: __dirname + '/fixtures' }))
          .get('/pets/../name.txt')
          .expect(200, 'tobi', done);
      });

      it('should work with trailing slash', function (done){
        request(createServer({ root: __dirname + '/fixtures/' }))
          .get('/name.txt')
          .expect(200, 'tobi', done);
      });

      it('should restrict paths to within root', function (done){
        request(createServer({ root: __dirname + '/fixtures' }))
          .get('/pets/../../send.js')
          .expect(404, done);
      });

      it('should allow .. in root', function (done){
        request(createServer({ root: __dirname + '/fixtures/../fixtures' }))
          .get('/pets/../../send.js')
          .expect(404, done);
      });

      it('should not allow root transversal', function (done){
        request(createServer({ root: __dirname + '/fixtures/name.d' }))
          .get('/../name.dir/name.txt')
          .expect(404, done);
      });
    });

    describe('when missing', function (){
      it('should consider .. malicious', function (done){
        request(createServer({ root: __dirname + '/fixtures/' }))
          .get('/../send.js')
          .expect(404, done);
      });

      it('should still serve files with dots in name', function (done){
        request(createServer({ root: __dirname + '/fixtures/' }))
          .get('/do..ts.txt')
          .expect(200, '...', done);
      });
    });
  });
});

function createServer(opts){
  var send = Send(opts.root, opts);

  return http.createServer(function (req, res){
    try {
      send.use(req, res).transfer();
    } catch (err) {
      res.statusCode = 500;
      res.end(err.message);
    }
  });
}
