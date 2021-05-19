/**
 * Generic WEB access logger.
 *
 * @author: Laurent Morin
 * @version: 1.0.0
 */

const fs = require('fs');
const util = require('util');
const winston = require('winston');

/**
 * A web logger supporting web access and log rotation.
 * An optional web access controller can be provided for the data part.
 *
 * Two logging threads are supported:
 *  A data logger: logs the content of a data
 *  A message logger: logs warnings, error, of debug information
 *
 * An HTTP route may be configured:
 *  logContent: send the list of available LOG files in Json format
 *  logFile: send the log file. Based on the same route but an HTTP parameter ":name" must be defined with the filename.
 *  Note: "logContent" reference the logs files using its own route as a prefix for the log file.
 *  
 * @class 
 * @param {string}        logp    - The log prefix used byt logging files.
 * @param {string}        logDir  - The log directory.
 * @param {AccessControl}  ac     - The web access control.
 */
function WebLogger(logp, logDir = './logs/', ac) {
    if (logDir[logDir.length] != '/') logDir += '/';
    this.logRotationSec = 8 * 60 * 60;
    this.logPrefix;
    this.myLogRe;
    this.dataLogger;
    this.logger;
    this.logDir = logDir;
    this.setLogPattern(logp);
    this.updateLogs();
    this.ac = ac;
}

/**
 * Configure a new logging prefix.
 *
 * Access rights take the form of the standard UNIX format RWX
 * @param {string}   prefix - the prefix string
 */
WebLogger.prototype.setLogPattern = function (prefix) {
    this.logPrefix=prefix;
    this.myLogRe = new RegExp(this.logPrefix+'.*\.jslog', 'i');
    //var myLogRe = /RmRelay-.*\.jslog/i;
}

/**
 * Logs a data (whatever it is) in Json format.
 *
 * @param {object}   data - the data to record
 */
WebLogger.prototype.logReq = function(data) {
    this.logger.info("Reception: "+util.inspect(data));
    this.dataLogger.info(data);
}

/**
 * Serves the list of log files available in the log directory in Json.
 * Require a read access right.
 *
 * Access rights take the form of the standard UNIX format RWX
 * @param {object} req - the HTTP request
 * @param {object} res - the HTTP response.
 */
WebLogger.prototype.logContent = function(req, res) {
    const access = this.ac ? this.ac.checkAccessRights(req, res) : 'r--';
    if (!access) return;
    if (access[0] != 'r') { res.status(401).send('Read access not set for user'); return; }

    var directories = {};
    directories.entries = [];
    try {
        const dir = fs.opendirSync(this.logDir);
        this.logger.debug("Open dir "+dir.path);
        while (dirent = dir.readSync()) {
            var n = dirent.name;
            this.logger.debug(n);
            var fst = fs.statSync(this.logDir+n);
            var url = req.protocol+'://'+req.hostname+req.originalUrl;
            if (url.substr(url.length - 1) != '/') url += '/';
            if (n.match(this.myLogRe) && fst.size > 0) {
                var e = { 'date': fst.ctime, 'size': fst.size, 'name' : n, 'url':  url + n }
                directories.entries.push(e);
            }
        }
        dir.close();
    }
    catch(err) {
        this.logger.debug("Could not open log dir: "+err.toString());
    };
    directories.entries = directories.entries.sort(function(a,b) { return (a.date > b.date) ? 1 : (a.date < b.date) ? -1 : 0; });
    res.send(directories);
}

/**
 * Serves the content of a log file from in the log directory in Json.
 * Require a read access right.
 *
 * Access rights take the form of the standard UNIX format RWX
 * @param {object} req - the HTTP request. Must contain the ':name' parameter.
 * @param {object} res - the HTTP response.
 */
WebLogger.prototype.logFile = function(req, res) {
    const access = this.ac ? this.ac.checkAccessRights(req, res) : 'r--';
    if (!access) return;
    if (access[0] != 'r') { res.status(401).send('Read access not set for user'); return; }

    var content= {};
    var fname = req.params.name;
    this.logger.debug("Request file "+fname);
    try {
        if (!fname.match(this.myLogRe)) {
            content = "{ 'error': 'incorrect file name', 'filename':'"+fname+"' }";
        }
        else {
            var pathname = this.logDir + fname;
            content = { 'filename': pathname };
            var fdat = fs.readFileSync(pathname, "utf8");
            var elist = [];
            var flist = fdat.split('\n');
            for (var index in flist) {
                var line = flist[index];
                if (line == "{" || line == "") continue;
                try {
                    var entry = JSON.parse(line);
                    if ('message' in entry) entry = entry['message'];
                    //if ('level' in entry) delete entry['level'];
                    elist.push(entry);
                }
                catch(err) {
                    this.logger.warn("Error parsing file "+pathname+": "+err.toString()+": '"+line+"'");
                    elist.push(line);
                }
            }
            content.data = elist;
        }
    }
    catch(err) {
        this.logger.debug("Could not open file "+fname+": "+err.toString());
    };
    res.send(content);
    res.end();
};

/*
 * Private Interface
 */

/**
 * Create a data logger thread using the winston manager.
 * @access protected
 *
 * @returns {winston}     - the data logger.
 */
WebLogger.prototype.createDataLogger= function () {
    var dataLogfilename = this.logDir + this.logPrefix + (new Date()).valueOf() + '.jslog';
    var dataLogger = winston.createLogger({
        level: 'info',
        format: winston.format.json(),
        transports: [ new winston.transports.File({ filename: dataLogfilename }) ]
    });
    return dataLogger;
}

/**
 * Create a message logger thread using the winston manager.
 * @access protected
 *
 * @returns {winston}     - the message logger.
 */
WebLogger.prototype.createLogger = function () {
    var logfilename = this.logDir + this.logPrefix + (new Date()).valueOf() + '.log';
    var myFormat = winston.format.printf(({ level, message, label, timestamp }) => {
        return `${timestamp} [${label}] ${level}: ${message}`;
    });

    var logger = winston.createLogger({
        level: 'info',
        format: winston.format.combine(
            winston.format.label({ label: 'interface' }),
            winston.format.timestamp({format: 'YY/MM/DD HH:mm:ss'}),
            winston.format.colorize(),
            myFormat
        ),
        transports: [
            new winston.transports.Console(),
            new winston.transports.File({ filename: logfilename })
        ]
    });
    return logger;
}

/**
 * Create a rotation of data and message logger.
 * @access protected
 *
 */
WebLogger.prototype.updateLogs = function () {
    this.dataLogger = this.createDataLogger();
    this.logger = this.createLogger();
    this.logger.warn('Updated logging files... ');
    var _this = this;
    setTimeout(function() { _this.updateLogs() }.bind({'service':this}), this.logRotationSec * 1000);
}

module.exports = WebLogger;
