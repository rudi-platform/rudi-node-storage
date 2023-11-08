/**
 * Mongo DB interface.
 *
 * @author: Laurent Morin
 * @version: 1.0.0
 */

// const util = require('util');
// const BasicFileEntry = require('./basicfile.js');
// const basicdb = require('./basicdb.js');
const mongodb = require("mongodb")

/**
 * Basic interface for the storage of LOG events MongoDB.
 *
 * @class
 * @param {json}        config       - The DB configuration with the MongoDB URL and its name.
 * @param {object}      schemaSet    - the schemas DB
 * @param {string}      mediaSchema  - the name of the media schema
 * @param {string}      eventSchema  - the name of the event schema
 */
class MongoService {
    constructor(config, schemaSet, mediaSchema, urlSchema, eventSchema) {
        this.disabled = config.disabled !== undefined && config.disabled == true
        this.mongoClient = mongodb.MongoClient
        this.schemaSet = schemaSet
        this.mediaSchema = mediaSchema
        this.urlSchema = urlSchema
        this.eventSchema = eventSchema
        this.mongoServerURL = config.db_url || "mongodb://localhost:27017/"
        this.dbname = config.db_name || "rudi_media"
        this.mongoOptions = config.db_options || {}
        this.mediaCollName = "media"
        this.urlCollName = "url"
        this.eventCollName = "media_events"
        this.mongodb = null
        this.db = null
        this.mediaColl = null
        this.urlColl = null
        this.eventColl = null
        this.currentError = null

        // console.debug('T [MongoService] mongoServerURL:', this.mongoServerURL)
    }
    /* eslint-disable no-multi-spaces, indent */
    /**
     * Open the Mongo DB using the class level parameters
     * A first collection is create for medias, and a second one for events.
     *
     * Has race conditions (#RC). In case njs starts to get (//) one day.
     *
     * @param {function}   errcb     - the error callback
     * @param {function}   done      - the success callback
     */
    async open() {
        if (typeof this.mongoOptions == "string") {
            const so = this.mongoOptions
            this.mongoOptions = {}
            this.mongoOptions = JSON.parse(so)
        }

        if (this.disabled) {
            console.debug("T [MongoService.open] Connexion disabled")
            throw new Error("Connexion disabled")
        }

        try {
            this.mongodb = await this.mongoClient.connect(this.mongoServerURL, this.mongoOptions)
            console.debug("T [MongoService.mongoClient.connect] DB connected:", this.mongodb.s?.url)

            this.db = this.mongodb.db(this.dbname)

            const colList = await this.db.listCollections().toArray()

            let hasMedia = false, hasUrl = false, hasEvents = false
            for (const c of colList) {
                hasMedia |= c.name == this.mediaCollName
                hasUrl |= c.name == this.urlCollName
                hasEvents |= c.name == this.eventCollName
            }
            if (hasMedia) {
                this.mediaColl = this.db.collection(this.mediaCollName)
                await this.mediaColl.drop()
            }
            if (hasUrl) {
                this.urlColl = this.db.collection(this.urlCollName)
                await this.urlColl.drop()
            }
            if (hasEvents) {
                this.eventColl = this.db.collection(this.eventCollName)
                await this.eventColl.drop()
            }

            // Command CollMod returns nothing according to the doc....
            // console.log(this.schemaSet.toBson(this.mediaSchema));
            // this.mediaColl = this.db.collection(this.mediaCollName);
            this.mediaColl = await this.initCollection(this.mediaCollName, this.mediaSchema)
            this.urlColl   = await this.initCollection(this.urlCollName, this.urlSchema)
            this.eventColl = await this.initCollection(this.eventCollName, this.eventSchema)
            
        } catch (err) {
            console.error("E [MongoService.mongoClient.connect] DB connection failed:", err)
            this.currentError = err
            throw err
        }
    }

    async initCollection(collName, colSchema){
        const coll = await this.db.createCollection(collName)
        await coll.createIndex({ uuid: 1 })
        await coll.createIndex({ zone: 1, uuid: 1 })
        await this.db.command({ 
            collMod: collName, 
            validator: { $jsonSchema: this.schemaSet.toBson(colSchema) },
            validationLevel: "strict", validationAction: "error" })
    }

    /**
     * Add a new media
     * The media must be an already initialized @BasicFileEntry object.
     *
     * @param {BasicFileEntry}   media   - a fileEntry object.
     * @param {function}         err     - the error callback
     * @param {function}         done    - the success callback
     */
    async addMedia(media, err, done = () => { }) {
        if (!this.mediaColl || !this.eventColl) {
            err("Collections not initialized")
            return
        }
        const errFct = (reason) => {
            if (err) err("Media insertion error: " + reason, this)
            else console.error("E [addMedia]", reason)
        }
        if (!("uuid" in media) || !("zone" in media)) {
            errFct("Malformed media descriptor")
            return
        }
        try {
            if ("url" in media) {
                const emedia = await this.urlColl.findOne({ uuid: media.uuid })
                // if (!emedia) console.log('URL add '+util.inspect(media));
                if (!emedia) done(await this.urlColl.insertOne(media))
                else done(await this.urlColl.updateOne({ uuid: media.uuid }, { $set: media }))
            } else {
                const emedia = await this.mediaColl.findOne({ uuid: media.uuid })
                // if (!emedia) console.log('MEDIA add '+util.inspect(media));
                if (!emedia) done(await this.mediaColl.insertOne(media))
                else done(await this.mediaColl.updateOne({ uuid: media.uuid }, { $set: media }))
            }
        } catch (err) {
            errFct(err)
        }
    }
    /**
     * Add a new event
     * The event must reference an object.
     *
     * @param {BasicFileEntry}   opdesc  - an operation description.
     * @param {function}         err     - the error callback
     * @param {function}         done    - the success callback
     * @param {function}         update  - update fields, by defaulf off
     */
    async addEvent(opdesc, err, done, update) {
        if (!this.mediaColl || !this.eventColl) {
            err("Collections not initialized")
            return
        }
        const errFct = (reason) => {
            if (err) err("Media event error: " + reason, this)
        }
        const doneFct = () => {
            if (done) done(this)
        }

        if (!("uuid" in opdesc) || !("zone" in opdesc)) {
            errFct("Malformed operation descriptor")
            return
        }

        // const emedia = false;
        try {
            if (!(update === undefined)) {
                const emedia = await this.eventColl.findOne({ uuid: opdesc.uuid })
                if (!emedia) doneFct(await this.eventColl.insertOne(opdesc))
                else doneFct(await this.eventColl.updateOne({ uuid: opdesc.uuid }, { $set: opdesc }))
            } else {
                doneFct(await this.eventColl.insertOne(opdesc))
            }
        } catch (err) {
            errFct(err)
        }
    }
    /* eslint-enable no-multi-spaces, indent */
    /**
     * Close the DB interface
     *
     * @param {function}   errcb    - the error callback
     */
    close(errcb, done) {
        if (!this.db) {
            if (errcb) errcb(this, "DB not initialized")
            return
        }
        this.mongodb.close()
        if (done) done(this)
    }
}





module.exports = MongoService
