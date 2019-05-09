## BoxMLS Docker Healthcheck Utility

Does analyze of the docker container where service is started.

#### Statuses checks

* `elastic_status`
* `git_status`
* `root_endpoint`
* `api_version`
* `system`

#### Usage

```js
// Initialize the docker object.
// It allows to set custom options
var healthcheck = require( 'boxmls/docker-healthcheck' ).create( {
  // By default, all statuses checks enabled
  // But you can disable status check for particular status.
  // e.g. elastic_status, since some services, such as mpo-rets-api, do not use Elasticsearch 
  "statuses": {
    "elastic_status": false
  }
} );

// Root Endpoint which is used for our status check
app.get('/', function( req, res ) {

  // Check all enabled statuses
  healthcheck.get( req, res, function() {
  
    // Available Vars:
    // healthcheck.error - contains process error.
    // healthcheck.results - contains all default statuses results.
    // healthcheck.haveError - boolean. Do we have error or not. It used to set statusCode 200 or 500.
  
    // Note you can extend response body by providing your custom data. It's optional
    var custom = {
      "my_custom_status_check": "it works"
    }
  	
    // After evrything is done. Send response
    healthcheck.send( custom );
    
  } );

} );
```