/**
 * Basic Media file descriptor
 *
 * @author: Laurent Morin
 * @version: 1.0.0
 */
const fs = require('fs');
const util = require('util');
const md5sum = require('md5');
const { v4: uuidv4 } = require('uuid');

/**
 * Represents a basic media entry.
 * @class 
 *
 * @classdesc The media descriptor, contains all related information.
 *  The media entry is constructed with the following format:
 *  <md5sum>;<uuid>;<filename>: <mimetype>; <encoding>;<creation date>;<size>
 *
 *  The complete meta-data can also be provided to the constructor.
 *
 * @param {string} descline - The description line from a CSV file.
 */
function BasicFileEntry(descline, metadata, context, filename, zone, size, md5) {
    if (metadata === undefined) {
        const [ md5, uuid, filetype, encoding, date, size] = descline.split(';');
        if (size === undefined) throw new Error('Could not parse '+descline);
        const [ filename, mimetype ] = filetype.split(':');
        this.md5=md5; this.uuid=uuid;
        this.filename=filename; this.mimetype=mimetype.trim(); this.encoding=encoding;
        this.date=date; this.size=size;
        this.zone = '';
    }
    else {
        try {
            this.uuid     = metadata.media_id;
            this.mimetype = metadata.file_type;
            this.filename = filename;
            this.zone     = zone;
            this.size     = size;
            this.md5      = md5;
            this.encoding = 'charset=us-ascii';
            this.date     = Date(0);
            this.metadata = metadata;
            this.context = context;
        }
        catch(err) { throw new Error('invalid meta-data: '+err+' value: '+metadata); }
    }
}

/**
 * Generate a unique connector ID for the media.
 * The connector generated is not managed by the media. Once generated, nothing is kept.
 * @returns {json} - Description of a new descriptor.
 */
BasicFileEntry.prototype.generateFileId = function() {
    return {
        uuid:this.uuid, id: uuidv4(),
        count: 0, access: [], cdate:Date(),
        zone:this.zone, basefile:this.filename,
        type:this.mimetype
    };
}

/**
 * Load the media content.
 * The data is loaded and processed if necessary before beeing sent.
 * @param {function=} none   - An optional callback with the error if no CSV was found.
 * @param {function} done    - A callback with the file when done.
 *                             Returns an array with the content and the mime type.
 */
BasicFileEntry.prototype.getFile = function(idesc, context, none, done) {
    if (!('source' in idesc)) {
        if (none) none(new Error('loading media: source missing in context'));
        return;
    }
    fs.readFile(idesc.source, { encoding:"utf8", flag:'r'}, function(err, data) {
        if (err) {
            console.log('--------- FAIL LOAD '+idesc.source+' -----------');
            if (none) none(new Error('loading media: file error'));
            return;
        }
        if (done) done(data, idesc.type);
    });
}

module.exports = BasicFileEntry;
