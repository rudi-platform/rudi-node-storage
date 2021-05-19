/**
 * Basic Media database
 *
 * @author: Laurent Morin
 * @version: 1.0.0
 */
const fs = require('fs');
const util = require('util');
const md5sum = require('md5');
const BasicFileEntry = require('./basicfile.js');

/**
 * Represents a basic media DB.
 * @class 
 *
 * @classdesc The basic media DB manage the list and the access of basic media ({BasicFileEntry}).
 * It is initialized by the path of the media directory, and by an optional CSV file name. If undefined
 * it as to be located in the media directory (list.csv).
 * 
 * @param {string} mediaDir - The media directory path
 * @param {object} logger   - The logging interface
 * @param {object} mongodb  - The mongo database interface
 */
function BasicFileDB(mediaDir, logger, mongodb, timeout) {
    this.mediaDir = mediaDir;
    this.wl = logger;
    this.connectorTimeout = timeout;

    this.storageId = {};
    this.db = {};
    this.mongodb = mongodb;
}

/**
 * Close the file database, and flush all pending events.
 *
 * @param {function=} none        - An callback with the error if problems while closing.
 * @param {function=} done        - An callback with the entry when done.
 */
BasicFileDB.prototype.close = function(none, done) {
    const errFct = function(err) {
        this.wl.logReq('Could not update DB: '+err);
        if (none) none('Could not close file database: '+err);
    };
    if (Object.keys(this.storageId).length > 0) {
        var pl = [];
        for (fileid in this.storageId) {
            pl.push(new Promise(function(resolve, reject) { this.service.deleleteFileId(this.fileid, { source: 'interruption' }, reject, resolve); }.bind({service:this, fileid:fileid})));
        }
        Promise.all(pl).then(done, errFct.bind({wl:this.wl}));
    }
    else done();
}

/**
 * Compute the real file path from the file and the zone.
 *
 * @private
 * @param {string}    filename,   - The media base filename.
 * @param {string}    zone        - The name of the zone. Currently a subdirectory.
 */
BasicFileDB.prototype.getPathFromConnector = function(filename, zone) {
    if (zone === undefined) zone = '';
    return this.mediaDir + (zone == '' ?  '/' :  '/'+zone+'/' ) + filename;
}

/**
 * Low level append a new basic media entry.
 *
 * @private
 * @param {string}    zone        - The name of the storage and access control zone.
 * @param {object}    context     - The request context.
 * @param {function=} none        - An callback with the error if meta-data are malformed.
 * @param {function=} done        - An callback with the entry when done.
 * @param {string}    line        - The description line from a CSV file.
 * @param {json}      metadata    - The meta-data dictionary.
 * @param {string}    filename    - The media base filename.
 * @param {integer}   size        - The file size.
 * @param {string}    hash        - The md5sum of the file content.
 */
BasicFileDB.prototype.buildEntry = function(zone, context, none, done, line, metadata, filename, size, hash) {
    try {
        const entry = new BasicFileEntry(line, zone, context, metadata, filename, size, hash);
        const opdesc = { operation: 'add_media', uuid: entry.uuid, ref: entry.uuid, zone: zone, context: context, value: entry };
        this.db[entry.uuid] = entry;
        this.wl.logReq(opdesc);
        const errFct = function(err) {
            this.wl.logReq('Could not update DB: '+err+' with '+JSON.stringify(this.desc));
            if (none) none(err);
        };
        this.mongodb.addMedia(entry, errFct.bind({wl:this.wl,desc:entry}), function(mongodb) {
            this.mongodb.addEvent(opdesc, errFct.bind({wl:this.wl,desc:opdesc}), function(mongodb) {
                if (this.done) this.done(opdesc);
            }.bind({wl:this.wl,done:this.done}));
        }.bind({wl:this.wl,mongodb:this.mongodb,done:done}));
    }
    catch(err) {
        this.wl.logger.error('Invalid media entry: '+err+' metadata: '+metadata);
        if (none) none(err);
    }
}

/**
 * Generate a Json Schema for an *event* with the proper registering URL.
 *
 * @param {string}     contextRef - The name of the context schema.
 * @returns {string}              - The name Json schema.
 */
BasicFileDB.eventSchema = function(contextRef) {
    return {
        "title": "The RUDI media DB event Schema",
        "description": "The descriptor of an event associated to a RUDI media DB access.",
        "type": "object",
        "properties": {
            "operation": {
                "description": "The operation done",
                "type": "string",
                "enum": [ "add_media", "new_conn", "del_conn", "acc_conn" ]
            },
            "uuid": {
                "description": "The open storage access uuid",
                "type": "string",
            },
            "ref": {
                "description": "The media-id",
                "type": "string",
            },
            "value": {
                "description": "The object manipulated by the operation",
                "type": "object"
            },
            "context": {"description":"The creaction context", "$ref":contextRef }
        },
        "required": [ "operation", "uuid", "ref" ]
    }
}

/**
 * Add a new basic media entry.
 *
 * @param {json}      metadata,   - The meta-data dictionary
 * @param {buffer}    filecontent - The raw file content
 * @param {function=} none        - An optional callback with the error if meta-data are malformed
 * @param {function=} done        - An optional callback with the entry when done.
 */
BasicFileDB.prototype.addEntry = function(metadata, context, filecontent, none, done) {
    if (!('media_id' in metadata)) {
        this.wl.logger.error('Missing media UUID: '+ metadata);
        if (none) none('Missing media UUID');
        return;
    }
    if (!('file_type' in metadata)) { metadata.file_type = 'text/text'; }
    const name = ('media_name' in metadata) ? metadata.media_name : 'media';
    const hash = md5sum(filecontent);
    const size = filecontent.length;
    const filename = metadata.media_id + '_' + name;
    const zone = 'zone1';
    const path = this.getPathFromConnector(filename, zone);
    fs.writeFile(path, filecontent, { flag:'w'}, function(err, data) {
        if (err) {
            this.service.wl.logger.error('could not write file: '+path);
            if (none) none(err);
            return;
        }
        this.service.buildEntry(zone, context, none, done, null, metadata, filename, size, hash);

    }.bind({service:this}));
}

/**
 * Load a CSV describing the media found in the directory.
 * Error are ignored if a line within the CSV is incorrect.
 *
 * @param {string}   csvFile - The filename of the CSV file. The format must be parsable by {BasicFileEntry} entries.
 * @param {function=} none   - An optional callback with the error if no CSV was found.
 * @param {function=} done   - An optional callback with the DB when done.
 */
BasicFileDB.prototype.loadCSV = function(csvFile, none, done) {
    fs.stat(csvFile, function(err,stats) {
        if (err) return;
        fs.readFile(csvFile, { encoding:"utf8", flag:'r'}, function(err, data) {
            if (err) {
                this.service.wl.logger.error('could not open CSV file: '+csvFile);
                if (none) none(err);
                return;
            }

            const zone = '';
            const context = { source:'CSV', filename:csvFile };
            const entries = data.split('\n');
            for (var index in entries) {
                const line = entries[index];
                if (!line || line == '') continue;
                this.service.buildEntry(zone, context, none, done, line);
                break;
            }
            if (done) { if (done) done(this.service.db); return; }
        }.bind({service:this.service}));
    }.bind({service:this}));
}

/**
 * Require an access to a media, and returns a connector ID if the access is granted.
 * This function creates a unique connector, an a timer to remove it on time.
 * 
 * @param   {string}   uuid  - The media UUID.
 * @returns {string}         - A unique connector ID.
 */
BasicFileDB.prototype.get = function(uuid, context) {
    //console.log('Check:'+uuid);
    if (!(uuid in this.db)) return null;
    const media = nid = this.db[uuid];
    var niddesc = media.generateFileId();
    niddesc.context = context;
    niddesc.source = this.getPathFromConnector(niddesc.basefile, niddesc.zone);
    var connectorTimeout = this.connectorTimeout;
    if ( 'timeout' in niddesc) {
        connectorTimeout = niddesc['timeout'];
    }
    this.storageId[niddesc.fileid] = niddesc;
    const opdesc = { operation: 'new_conn', uuid: niddesc.fileid, ref: uuid, zone: niddesc.zone, context: context };
    this.wl.logReq(opdesc);

    const errFct = function(err) { this.wl.logReq('Could not update DB: '+err+' with '+JSON.stringify(this.desc)); };
    this.mongodb.addEvent(opdesc, errFct.bind({wl:this.wl,desc:opdesc}), function(mongodb) {});

    setTimeout(function() {
        this.db.deleleteFileId(this.fileid, context, errFct, function(mongodb) {});
    }.bind({'db':this, fileid: niddesc.fileid}), connectorTimeout * 1000);
    return niddesc.fileid;
}

/**
 * Delete a storage connector.
 * 
 * @private
 * @param   {string}   fileid  - The file UUID.
 */
BasicFileDB.prototype.deleleteFileId = function(fileid, context, none, done) {
    if (fileid in this.storageId) {
        const niddesc = this.storageId[fileid];
        delete this.storageId[fileid];
        const opdesc = { operation: 'del_conn', uuid: niddesc.fileid, ref: niddesc.ref, zone: niddesc.zone, context: context, value: niddesc };
        this.wl.logReq(opdesc);
        this.mongodb.addEvent(opdesc, none.bind({wl:this.wl,desc:opdesc}), done);
    }
}

/**
 * Send the media content using a connector ID.
 * This function records the access and provide the necessary information to load the data.
 * 
 * @param   {string}   uuid - The connector UUID.
 * @param {function=} none   - An optional callback with the error.
 * @param {function}  done   - An callback with the media content and the mime type.
 */
BasicFileDB.prototype.find = function(fileid, context, none, done) {
    if (!(fileid in this.storageId)) {
        const errmsg = 'media connector id "'+fileid+'" not found';
        this.wl.logger.error(errmsg+' request context: '+JSON.stringify(context));
        if (none) none(new Error(errmsg));
        return;
    }
    const now = new Date();
    const iddesc = this.storageId[fileid];
    const accessEntry = { date:now, client: context};
    const opdesc = { operation: 'acc_conn', uuid: iddesc.fileid, ref:iddesc.ref, zone: iddesc.zone, context: accessEntry };
    this.wl.logReq(opdesc);
    const errFct = function(err) { this.wl.logReq('Could not update DB: '+err+' with '+JSON.stringify(this.desc)); };
    this.mongodb.addEvent(opdesc, errFct.bind({wl:this.wl,desc:opdesc}), function(mongodb) {});
    iddesc.count += 1;
    iddesc.access.push(accessEntry);

    // Load the data asynchronously
    const media = this.db[iddesc.ref];
    media.getFile(iddesc, context, function(err) {
        this.wl.logger.error('could not load file: '+err+' request context: '+JSON.stringify(context));
        if (none) none(err);
    }.bind({wl:this.wl}), done);
}

module.exports = BasicFileDB;
