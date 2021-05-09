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
 * @param {string=} csvFile - The initialization CSV file
 */
function BasicFileDB(mediaDir, csvFile, logger) {
    this.mediaDir = mediaDir;
    this.csvFile = csvFile;
    this.lw = logger;
    this.connectorTimeout = 60 * 1;
    if (csvFile === undefined) {
        this.csvFile = this.mediaDir + '/list.csv';
    }

    this.storageId = {};
    this.db = {};
    this.loadCSV(this.csvFile);
}

/**
 * Compute the real file path from the file and the zone.
 *
 * @param {string}    filename,   - The media base filename.
 * @param {string}    zone        - The name of the zone. Currently a subdirectory.
 */
BasicFileDB.prototype.getPathFromConnector = function(filename, zone) {
    if (zone === undefined) zone = '';
    return this.mediaDir + (zone == '' ?  '/' :  '/'+zone+'/' ) + filename;
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
        this.lw.logger.error('Missing media UUID: '+ metadata);
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
            this.lw.logger.error('could not write file: '+path);
            if (none) none(err);
            return;
        }
        try {
            const entry = new BasicFileEntry(null, metadata, context, filename, zone, size, hash);
            this.db[entry.uuid] = entry;
            this.lw.logReq({ operation: 'add_media', value: entry });
            done(entry);
        }
        catch(err) {
            this.lw.logger.error('Invalid media entry: '+err+' metadata: '+metadata);
            if (none) none(err);
        }
    }.bind({db:this.db, lw:this.lw}));
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
                this.lw.logger.error('could not open CSV file: '+csvFile);
                if (none) none(err);
                return;
            }

            const entries = data.split('\n');
            for (var index in entries) {
                const line = entries[index];
                try {
                    if (!line || line == '') continue;
                    const entry = new BasicFileEntry(line);
                    this.db[entry.uuid] = entry;
                    this.lw.logReq({ operation: 'add_media', value: entry });
                }
                catch(err) {
                    this.lw.logger.error('Invalid media: '+err+' line ignored: '+line);
                }
            }
            if (done) { if (done) done(this.db); return; }
        }.bind({db:this.db, lw:this.lw}));
    }.bind({db:this.db, lw:this.lw}));
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
    this.storageId[niddesc.id] = niddesc;
    this.lw.logReq({ operation: 'new_conn', value: niddesc });

    setTimeout(function() {
        if (niddesc.id in this.db.storageId) {
            delete this.db.storageId[niddesc.id];
            this.db.lw.logReq({ operation: 'del_conn', value: niddesc });
        }
    }.bind({'db':this, niddesc: niddesc}), connectorTimeout * 1000);
    return niddesc.id;
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
        this.lw.logger.error(errmsg+' request context: '+JSON.stringify(context));
        if (none) none(new Error(errmsg));
        return;
    }
    const iddesc = this.storageId[fileid];
    const accessEntry = { date:Date(), client: context};
    this.lw.logReq({ operation: 'acc_conn', value: iddesc.id, context: accessEntry });
    iddesc.count += 1;
    iddesc.access.push(accessEntry);

    // Load the data asynchronously
    const media = this.db[iddesc.uuid];
    media.getFile(iddesc, context, function(err) {
        this.lw.logger.error('could not load file: '+err+' request context: '+JSON.stringify(context));
        if (none) none(err);
    }.bind({lw:this.lw}), done);
}

module.exports = BasicFileDB;
