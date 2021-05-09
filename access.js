/**
 * Generic HTTP access management.
 *
 * @author: Laurent Morin
 * @version: 1.0.0
 */

var util=require('util');

/**
 * A simple authorization filter for express.
 * The access rights are static and controlled by a tables.
 *
 * @class 
 * @param {json}      authorizedVersion - The list of authorized version.
 * @param {json}      authorizedUsers   - The list of authorized users.
 * @param {weblogger} logger            - The access logger.
 */
function AccessControl(authorizedVersion, authorizedUsers, logger) {
    this.authorizedVersion = authorizedVersion;
    this.authorizedUsers = authorizedUsers;
    this.logger = logger;
}

/**
 * Check the access rights and prepare a proper HTTP response.
 * Access rights take the form of the standard UNIX format RWX
 * If the access requires execution rights, the HTPP header must provide a correct API version.
 *
 * @param {object}   req    - the HTTP request
 * @param {object}   res    - the HTTP response.
 * @param {object}   cver   - access requiring execution rights.
 * @returns {string}        - the access rights.
 */
AccessControl.prototype.checkAccessRights = function (req, res, cver=false) {
    var access = this.getAccessRights(req.headers);
    var code = 200;
    var errMsg = "access";
    switch(access) {
    case 'E01':
        res.set('WWW-Authenticate', 'Basic realm="Authentication required"');
        code = 401; errMsg = 'Authentication required';
        access = null;
        /* */ break;
    case 'E12':
        req.session.error = 'Incorrect version';
        code = 412; errMsg = 'Incorrect version';
        access = null;
        /* */ break;
    case 'E05':
        res.set('WWW-Authenticate', 'Basic realm="Authentication method invalid"');
        code = 405; errMsg = 'Authentication method invalid';
        access = null;
        /* */ break;
    }
    this.logAccess(code, errMsg, req, res);
    return access;
}

/*
 * Private interface
 */

/**
 * Analyse the access rights given by the header.
 * @access protected
 *
 * Access rights take the form of the standard UNIX format RWX
 * @param {object}   header - the HTTP header
 * @param {object}   cver   - access requiring execution rights.
 * @returns {string}        - either the access rights or an HTTP error.
 */
AccessControl.prototype.getAccessRights = function (header, cver=false) {
    if (!('authorization' in header)) {
        return 'E01'; // http 401
    }

    var execute = '-';
    if ('version' in header) {
        const version = header['version'];
        for (i in this.authorizedVersion) {
            if (version == this.authorizedVersion[i]) {
                execute = 'x';
                break;
            }
        }
    }
    if (cver && execute != 'x') return 'E12'; // http 412

    const authorization = header['authorization'];
    const [authType, b64auth] = (authorization.split(' ') || '');
    if (authType.toLowerCase() == 'basic') {
        const [login, password] = Buffer.from(b64auth, 'base64').toString().split(':')
        for (i in this.authorizedUsers) {
            const [u, p, a] = this.authorizedUsers[i];
            if (login == u && password == p) {
                a[2] = (a[2] == 'x') ? execute : '-';
                return a;
            }
        }
    }
    else return 'E05'; // http 405
    return 'E01'; // http 401
}

/**
 * Generate a log message
 * Access rights take the form of the standard UNIX format RWX
 * @access protected
 *
 * @param {object} code   - the HTTP return code
 * @param {object} errMsg - optional error message.
 * @param {object} req    - the HTTP request
 * @param {object} res    - the HTTP response.
 */
AccessControl.prototype.logAccess = function(code, errMsg, req, res) {
    const authorization = ('authorization' in req.header) ? req.header['authorization'] : '';
    if (!this.logger) return;
    if (code != 200) {
        this.logger.error(errMsg+": "+req.hostname+":"+req.originalUrl+":"+req.ip+":"+util.inspect(req.params)+":"+authorization);
        res.status(code).send(errMsg);
    }
    else this.logger.debug(errMsg+": "+req.hostname+":"+req.originalUrl+":"+req.ip+":"+util.inspect(req.params)+":"+authorization);
}


module.exports = AccessControl;
