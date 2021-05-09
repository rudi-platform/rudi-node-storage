![](logo.png)

RUDI Media Driver - The media connector manager for RUDI
========================================================

The RUDI media driver interface media file access between the the RUDI Productor manager
(managing metadata entries for an open-data producer), and the storage system
[typically IRODS](#https://irods.org/).

* * *

The Media driver core feature is to provide access to media files
associated to data publish via the RUDI open-data framework. It is
currently extended with a logging system, and an isolation mechanism.

### List of features

The Media driver provides :
* An API for posting and fetching media files associated to RUDI data
    sets.
* A isolation mechanism, providing a real file access after a
    generation of an access link with a connectors.
* A basic access control system.
* A dual log mechanism, one for the application, one for the media
    data management (new/open/close, etc.).

### Current deployment

The system is currently deployed on the development namespace
*shared*:
[https://shared-rudi.aqmo.org/media/](#https://shared-rudi.aqmo.org/media/)

Two user/login exists currently:
With read access: rudiadmin [sysadminisgreat!]
With write access: rudiprod [sysadminisgreat!]

### Media Driver API

The current API is divided in two: the file access API, and the log API

#### File Access
The API is the following :
1. To post a meta-data:
- *POST* https://shared-rudi.aqmo.org/media/post [in header: *file-metadata*: Json description ]
The file-metadata json must contain a field *media_id*, and should contain
the standard [RUDI meta-data](https://app.swaggerhub.com/apis/OlivierMartineau/RUDI-PRODUCER/1.2.0#/Media)
An account with write access is required. 

A simple CURL command to post the file *mon_nom.json*:
```shell
curl -u rudiprod:rudiirods2022  -H 'file_metadata:{"media_name":"mon_nom","media_id":"37df63aa-1aae-4279-be3b-b07076d36131","file_size":21660,"file_type":"application/json"' --data-binary @mon_nom.json https://shared-rudi.aqmo.org/media/post
```

2. To get a meta-data:
- *GET* https://shared-rudi.aqmo.org/media/UUID
Returns a Json with the temporary file link. It is available for 2 minutes by default.
- Example:
```json
{"url":"https://shared-rudi.aqmo.org/media/storage/55643808-dd0c-48d9-941e-c21736d5e4e5"}
```

3. All requests returns a status in Json with the format:
```json
      { 'status': <ok|error>, ['msg': <description>], ['value':<context information>] }
```

#### Log System

The log system create a list of files in rotation indexed by the timestamp.
All data are returned in Json format. To get access to the list use the URL
[https://shared-rudi.aqmo.org/media/logs/](https://shared-rudi.aqmo.org/media/logs/).

Example:
```json
{"entries":[{"date":"2021-05-09T14:08:40.686Z","size":109192,"name":"RudiMedia-1620569320362.jslog","url":"http://shared-rudi.aqmo.org/media/logs/RudiMedia-1620569320362.jslog"}]}
```

To get access to the file management log for a given period, use the provided url:
http://shared-rudi.aqmo.org/media/logs/RudiMedia-XXXX.jslog

All access to the log data require an account with read access.

### Download & Installation

You are not supposed to install this driver. But it is a simple nodejs/express project.

```shell 
$ npm install 
```

### TODO

- [x] Feature: basic file DB @lmorin
- [x] Feature: GET API  @lmorin
- [x] Feature: Log management @lmorin
- [x] Feature: Access control @lmorin
- [x] Feature: POST API  @lmorin
- [ ] Feature: INI configuration file
- [ ] Feature: file-management storage in mongodb
- [ ] Feature: log-management in mongodb

### Authors or Acknowledgments

*   Laurent Morin - Université Rennes 1

### License

This project is licensed under the MIT License
