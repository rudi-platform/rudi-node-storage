/**
 * RUDI media access driver.
 *
 * @author: Laurent Morin
 * @version: 1.0.0
 */
const express = require('express');
const process = require('process');
const util = require('util');
const argv = require('minimist')(process.argv.slice(2));

var WebLogger = require('./weblogger.js');
const AccessControl = require('./access.js');
const basicdb = require('./basicdb.js');

/**
 * The code express based HTTP server.
 * The web server creates the media db, and serves:
 *  - a route for requesting a connector for a media UUID 
 *  - a route for loading the data loaded from a media UUID.
 *
 * @class 
 * @param {integer} port     - The listening port.
 * @param {integer} mediaDir - The media library directory.
 * @param {string}  logName  - The logger prefix value.
 * @param {string}  logDir   - The logger storage directory.
 */
function HttpService(port, mediaDir, logName, logDir) {
    this.server = 'https://shared-rudi.aqmo.org';
    this.httpPrefix = '/media/';
    this.httpServer = express();

    this.authorizedUsers=[
        [ 'rudiadmin', 'sysadminisgreat!', 'r--' ], // 
        [ 'rudiprod', 'sysadminisgreat!', '-wx' ], // 
    ];
    this.authorizedVersion=[
        '9bdf6d99e8b7f053f417bc4018b2f540'
    ];

    this.wl = new WebLogger(logName, logDir, null);
    this.ac = new AccessControl(this.authorizedVersion, this.authorizedUsers, this.wl.logger);
    this.wl.ac = this.ac;
    this.icon = new Buffer.from('AAABAAEAEBAAAAEAIABoBAAAFgAAACgAAAAQAAAAIAAAAAEAIAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACe7OkFqNqYQ6jZlKWo2ZTjpdiR+5bQgvuc04Pj5PWgovv/qED4/6cEAAAAAAAAAAAAAAAAAAAAAAAAAACb7/wSm+/7h6Hlyeyo2pb/qNmU/6XYkv+W0IL/ndOD/+n4of/5/6fq+P+ng/j/pxAAAAAAAAAAAAAAAACa7/sQm+/7oZvv+/2b7/j/ouTG/6jalv+m2JH/ltCC/53Tg//p+KH/+f+n//j/p/34/6eb+P+mDgAAAACf7voBm+/7e5vv+/yb7/v/m+/8/5vu+P+i5MX/pdiT/5bQgv+d04P/6fih//n/p//4/6f/+P+n+/j9p3UAAAAAnPD7MZvw++Cb7/v/m+/7/5vv+/+b8Pz/nO/4/5/iwv+V0IT/ndOD/+n4of/5/6f/+P+n//j7qP/35qvc9tStLJPl+YWV5/n+lef5/5Xn+f+V5/n/lef5/5bo+viY7PbSj9mq053Tg/jp96H/+f+n//j8p//35av/9tat/fbWrX1+yfPEfsnz/37J8/9+yfP/fsr0/37K9PqAy/SHkOj/FITcuhWk14eN6vii+/n9qP/35av/9tat//bWrf/21q28fMfz33zH8/98x/P/fMfz/3zF8/+AqOvYgpDmGgAAAAAAAAAA4/efHfb7p9z35qv/9tat//bWrf/21q3/9tat2HzH8958x/P/fMfz/3zG8/+BoOr/iXTf2Z173hwAAAAAAAAAAPnuqh/346vd9tet//bWrf/21q3/9tat//bWrdh8x/PCfMfz/3zH8/+Boer/h3Lf/5R43/vJpOOP5a3TGuWTrhvzya2S9M6t/PTOrf/0zq3/9M6t//TOrf/00K26fMfzgnzH8/6Bour/iHPf/4du3v+Ved//zqjk+dup2Nnfg7La4oit+uKKrf/iiq3/4oqt/+KKrf/iiq3944+te3zK8y6Boerdh3Tf/4hu3v+Hbt7/lXnf/86o5P/TqeP/0YnI/917rv/eeq3/3nqt/956rf/eeq3/3nqt2t55rSoAAAAAiHDedohu3vuIb97/h27e/5V53//OqOT/0qrj/8SS3v/Phcf/3Xyu/957rf/ee63/3nut+t57rXAAAAAAAAAAAIdu3g2Ib96aiG/e/Idu3v+Ved//zqjk/9Kq4//Ekt//wo7d/9CFxv/dfK7/3nut/N57rZXee60MAAAAAAAAAAAAAAAAiG7eD4hv3n+Hbt7nlXnf/86o5P/SqeP/xJLf/8KP3v/Dj93/0YXF5d57rXvfeqwOAAAAAAAAAADT0c4F09HOBeHjyASwotIGjHXdQJp/357PquPd0qrj+MST3/jCkN7dw5LencSV3D7Tr8cG0N/VBNPRzgXT0c4F+B8AAOAHAADAAwAAwAMAAIABAAAAAQAAAYAAAAPAAAADwAAAAYAAAAABAACAAQAAwAMAAMADAADwDwAA+B8AAA==', 'base64');
    this.db = new basicdb(mediaDir, mediaDir + '/list.csv', this.wl);


    this.httpServer.get(this.httpPrefix+'favicon.ico', function(req, res) { service.favicon(req,res); }.bind({'service':this}));
    this.httpServer.get(this.httpPrefix+'', function(req, res) { service.root(req, res) }.bind({'service':this}));
    this.httpServer.get(this.httpPrefix+'logs', function(req, res) { service.wl.logContent(req, res) }.bind({'service':this}));
    this.httpServer.get(this.httpPrefix+'logs/:name', function(req, res) { service.wl.logFile(req, res) }.bind({'service':this}));
    this.httpServer.get(this.httpPrefix+'storage/:fileid', function(req, res) { service.fileService(req, res) }.bind({'service':this}));
    this.httpServer.post(this.httpPrefix+'post', function(req, res) { service.postFile(req, res) }.bind({'service':this}));
    this.httpServer.get(this.httpPrefix+':uuid', function(req, res) { service.media(req, res) }.bind({'service':this}));
    this.httpServer.listen(p);
}

/**
 * Serves a favicon. For fun because I like it (CC Licence).
 * @param {object} req - the HTTP request
 * @param {object} res - the HTTP response.
 */
HttpService.prototype.favicon = function(req, res) {
    res.statusCode = 200;
    res.setHeader('Content-Length', this.favicon.length);
    res.setHeader('Content-Type', 'image/x-icon');
    res.setHeader("Cache-Control", "public, max-age=2592000");                // expiration: after a month
    res.setHeader("Expires", new Date(Date.now() + 2592000000).toUTCString());
    res.end(this.icon);
}

/**
 * Serves the default page.
 * @param {object} req - the HTTP request
 * @param {object} res - the HTTP response.
 */
HttpService.prototype.root = function(req, res){
    res.send('<!DOCTYPE html>\
<html lang="en">\
  <head><meta charset="utf-8"><title>Rudi media access driver</title></head>\
  <body>\
    <H1>Rudi media access driver, access restricted</H1>\
    <H2><a href="'+this.httpPrefix+'logs/" >Log file list (requires authorization)</a></H2>\
  </body>\
</html>');
}

/**
 * Create a request context.
 * The context is used to process requests,
 *   and contains basic information about the sender.
 * @param {object} req - the HTTP request
 */
HttpService.prototype.generateContext = function(req) {
    const srcip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    //console.log('from:'+ip);
    return { ip: srcip };
}

/**
 * Serves a post of a new media.
 * The post HTTP header must contain the ":file_metadata" with all necessary fields.
 *
 * @param {object} req - the HTTP request
 * @param {object} res - the HTTP response.
 */
HttpService.prototype.postFile = function(req, res) {
    const access = this.ac ? this.ac.checkAccessRights(req, res) : null;
    if (!access) return;
    if (access[1] != 'w') { res.status(401).send('Write access not set for user'); return; }

    var content= {};
    if (!('file_metadata' in req.headers)) {
        content = { status: 'error', msg:'no meta-data provided' };
        res.send(content);
        res.end();
        return;
    }
    var metadata = req.headers.file_metadata;
    try { metadata = JSON.parse(metadata); }
    catch(err) {
        content = { status: 'error', msg:'malformed metadata' };
        this.wl.logger.error('malformed metadata: '+req.params.file_metadata);
        res.send(content);
        res.end();
        return;
    }

    // Bufferize file data
    var filecontent = '';
    req.on('readable', function() {
        var chunk;
        while (null !== (chunk = req.read())) {
            filecontent += chunk;
        }
    });
    // Build the entry, Close the request
    req.on('end', function() {
        this.service.wl.logger.debug('content: '+filecontent);

        const context = this.service.generateContext(req);
        const nid = this.service.db.addEntry(metadata, context, filecontent, function() {
            content = { status: 'error', msg:'invalid request' };
            res.send(content);
            res.end();
        }, function() {
            content = { status: 'OK' };
            res.send(content);
            res.end();
        });
    }.bind({service:this}));
};

/**
 * Serves the media connector creation API.
 * @param {object} req - the HTTP request
 * @param {object} res - the HTTP response.
 */
HttpService.prototype.media = function(req, res) {
    var content= {};
    var uuid = req.params.uuid;
    const context = this.generateContext(req);
    const nid = this.db.get(uuid, context);
    if (!nid) content = { status: 'error', msg:'invalid request' };
    else      content = { url:this.server + this.httpPrefix+'storage/'+ nid };
    res.send(content);
    res.end();
};

/**
 * Serves the access to the media content from a connector.
 * @param {object} req - the HTTP request
 * @param {object} res - the HTTP response.
 */
HttpService.prototype.fileService = function(req, res) {
    var content= {};
    const fileid = req.params.fileid;
    const context = this.generateContext(req);

    this.db.find(fileid, context, function(err) {
        res.type('application/json');
        res.status(401).send({ status: 'error', msg:"could not get media content"});
        res.end();
    }, function(data, mimetype) {
        content = data;
        res.type(mimetype);
        res.send(content);
        res.end();
    });
};

/**
 * Parse command line arguments
 * @param {integer} - the default port
 */
function parseArguments(port) {
    if (argv["p"]) {
        var np = parseInt(argv["p"], 10);
        if (np != NaN) p = np;
    }
    const mediaDir = process.env.HOME + '/media';

    // Error mgmt.
    if (p < 80 ) {
        console.log('Incorrect port provided: '+p);
        process.exit(-1);
    }
    return [ p, mediaDir ]
}

const [ port, mediaDir ] = parseArguments(3201);
service = new HttpService(p, mediaDir, 'RudiMedia-', './logs/');
