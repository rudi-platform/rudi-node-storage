

/**
 * The global configuration.
 * @typedef {Object} DEFAULT_CONF
 * @property {object} server   - Configuration of the HTTP server, include access control
 * @property {object} schemas  - Configuration of the shema name-spaces
 * @property {object} storage  - Configuration of the RUDI storage system
 * @property {object} database - Configuration of mongo database logging system events
 * @property {object} logging  - Configuration of system logger
 */
const DEFAULT_CONF = {
    server: {
        listening_address: "0.0.0.0",
        listening_port: 8080,
        server_url: 'https://shared-rudi.aqmo.org',
        server_prefix: '/media/',
        authorized_version: [ '9bdf6d99e8b7f053f417bc4018b2f540' ],
        authorized_users: [
            [ 'rudiadmin', '$1$1586de76f5f26e8a6dbbe05182e4dc94$', 'r--' ], // 
            [ 'rudiprod', '$1$1586de76f5f26e8a6dbbe05182e4dc94$', '-wx' ], // sysadminisgreat!
        ],
        close_timeout: 60*20
    },
    schemas: {
        schema_basename: 'rudi-media-db-',
        schema_context: 'context.json',
        schema_meta: 'meta.json',
        schema_event: 'event.json',
        schema_file: 'file.json'
    },
    storage: {
        media_dir: process.env.HOME + '/_media',
        media_files: [ process.env.HOME + '/_media/list2.csv' ],
        acc_timeout: 60 * 2,
    },
    database: {
        db_url: "mongodb://localhost:27017/",
        db_name: "rudi_media"
    },
    logging: {
        revision: '-',
        app_name: 'RudiMedia-',
        log_dir: './logs/'
    },
    log_server: {
        path: "127.0.0.1"

//        path: "/dev/log",
//        transport: 4
    },
    log_local: {
        prefix: 'RudiMedia-',
        console: true,
        consoleData: false
    }
};

module.exports = DEFAULT_CONF;
