/**
 * Docker Healthcheck
 *
 */

var _             = require('lodash');
var async         = require('async');
var request       = require('request');
var childProcess  = require('child_process');
var	os            = require('os');
var url           = require('url');
var	countdown     = require('countdown');
var	prettyBytes   = require('prettier-bytes');

Object.defineProperties( module.exports, {
  create: {
    value: function create( options ) {
      return new healthcheck( options );
    },
    enumerable: true,
    writable: true
  },
  version: {
    value: 0.1,
    writable: false
  }
});

/**
 *
 */
function healthcheck( options ) {

  var _now = new Date();

  options = _.defaults( options || {}, {
    "started": process.env.API_STARTED || _now,
    "es_address": 'http://' + ( process.env.ES_ADDRESS || 'localhost:9200' )
  });

  // Determine which statuses enabled/disabled
  options.statuses = _.defaults( _.get( options, 'statuses', {} ), {
    "elastic_status": true,
    "git_status": true,
    "root_endpoint": true,
    "api_version": true,
    "system": true
  });

  var self = this;

  self.error = null;
  self.haveError = false;
  self.results = {};

  /**
   *
   * @param next
   */
  self.get = function( req, res, next ) {

    self.req = req;
    self.res = res;

    var statuses = {};

    if( options.statuses.elastic_status ) {
      statuses.elastic_status = [ function( callback ) {

        request.get( {
          json: true,
          timeout: 1500,
          url: options.es_address
        }, function elasticStatus( error, resp, body ) {

          var data;

          if(body && !error) {
            data = {
              status: 200,
              name: body.name,
              version: body.version ? body.version.number : null,
              cluster: body.cluster_name
            }
          } else if (body && error) {
            data = {
              status: 200,
              error: error
            }
          } else {
            data = {
              status: 500
            }
          }

          callback(null, data);
        });
      }];
    }

    if( options.statuses.git_status ) {
      statuses.git_status = [ function(callback) {

        childProcess.exec( 'git rev-parse HEAD', function( error, stdout, stderr ) {
          var details = {
            name: _.get(process, 'env.GIT_NAME'),
            branch: _.get(process, 'env.GIT_BRANCH'),
            sha: stdout.toString().trim()
          };

          if(!error && !_.isEmpty(stderr)) {
            error = new Error( "Error occurred: " + stderr );
          }

          callback( error, details);
        } );

      }];
    }

    if( options.statuses.git_status ) {
      statuses.root_endpoint = [ function(callback){
        var host = _.get( req, 'headers.host' );
        var origin = _.get( req, 'headers.origin', null );
        var referer = _.get( req, 'headers.referer', null );
        var urlParts = url.parse( referer || origin || ( 'http://' + host ) );

        callback(null, urlParts)
      }];
    }

    if( options.statuses.api_version ) {
      statuses.api_version = [ function(callback){
        var version = require( 'root-require' )( 'package.json' ).version;
        callback(null, version);
      }];
    }

    if( options.statuses.system ) {
      statuses.system = [ function(callback){

        var system = {
          memory : {
            free : prettyBytes(os.freemem()),
            total : prettyBytes(os.totalmem())
          },
          os : {
            arch : os.arch(),
            hostname : os.hostname()
          },
          uptime : countdown(new Date( options.started ), new Date()).toString()
        };

        callback(null, system);

      }];
    }

    async.auto( statuses, function(err, results) {
      self.error = err;
      self.haveError = haveError( err, results );
      self.results = results;
      next(err, results);
    });

  }

  /**
   *
   * @param req
   * @param res
   * @returns {*}
   */
  self.send = function( response ) {

    if( self.res._headerSent ) {
      return;
    }

    //console.log(require('util').inspect( self.results, {showHidden: false, depth: 10, colors: true}));
    //console.log(require('util').inspect( self.req.headers, {showHidden: false, depth: 10, colors: true}));

    response = _.extend( {
      ok: !self.haveError,
      version: _.get( self.results, 'api_version' ),
      message: self.haveError ? _.get( self.results, 'git_status.name', '' ) + " unhealthy." : _.get( self.results, 'git_status.name', '' ) + " healthy.",
      elastic: _.get( self.results, 'elastic_status' ),
      git: _.get( self.results, 'git_status' ),
      system: _.get( self.results, 'system' ),
      endpoint: _.get( self.results, 'root_endpoint.href' )
    }, ( typeof response == 'object' ? response : {} ) );

    return self.res.status( self.haveError ? 500 : 200 ).json( response );

  }

  /**
   *
   * @param err
   * @param results
   * @returns {boolean}
   */
  function haveError( err, results ) {
    if( err ) {
      return true;
    }

    if( options.statuses.elastic_status && ( results.elastic_status.error || results.elastic_status.status !== 200 ) ) {
      return true;
    }

    return false;

  }

}