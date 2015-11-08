var map;
var yelpResults;
var openWindow;
var geocoder;

var NeighborHoodMapViewModel = function() {
  var self = this;
  self.resultList = ko.observableArray();
  self.ratingFilter = ko.observable(1);
  self.center = ko.observable({});

  self.filteredResultList = ko.computed(function() {
    var filterArray = [];
    for (var i = 0; i < self.resultList().length; i++) {
      if (self.resultList()[i].rating >= self.ratingFilter()) {
        filterArray.push(self.resultList()[i]);
      }
    }
    console.log('filtered out ' + (self.resultList().length - filterArray.length) + ' items');
    if (resultList().length === 0) {
      $('#resultsList').css('height', '50px');
    } else {
      adjustResultsListHeight();
    }
    return filterArray;

  });
  self.numResultsHTML = ko.computed(function() {
    var HTML = '<span class="mdl-badge" data-badge="%NUM%">Results</span>';
    HTML = HTML.replace("%NUM%", filteredResultList().length);
    return HTML;

  });
  self.mapMarkers = ko.observableArray();
  self.searchLocation = ko.observable('');
  self.maxRegionDelta = ko.observable();
  self.searchTerm = ko.observable(''); 
  self.zoomLevel = ko.computed(function() {
    //further optimization required, this really only works for desktop of a certain resolution
    if (self.maxRegionDelta() > 0.5) {
      return 10;
    } else if (self.maxRegionDelta() > 0.22) {
      return 11;
    } else {
      return 12;
    }
  });

  self.toggleFilterView = function() {
      if ($('#ratingFilter').css('display') === 'none') {
        $('#ratingFilter').show('slow');
      } else {
        $('#ratingFilter').hide('slow');
      }

    },


    self.setZoom = function() {
      map.setZoom(zoomLevel());
      console.log("zoom set to " + zoomLevel());
    },

    self.yelpSearch = function(formElement) {
      self.centerMap('' + self.searchLocation() + '');

      parameters = [];
      parameters.push(['term', self.searchTerm()]);
      parameters.push(['location', self.searchLocation()]);
      parameters.push(['radius_filter', Yelp.defaultRadius]);
      parameters.push(['callback', 'self.searchSuccess']);
      parameters.push(['oauth_consumer_key', Yelp.auth.consumerKey]);
      parameters.push(['oauth_consumer_secret', Yelp.auth.consumerSecret]);
      parameters.push(['oauth_token', Yelp.auth.accessToken]);
      parameters.push(['oauth_signature_method', 'HMAC-SHA1']);

      var message = {
        'action': 'http://api.yelp.com/v2/search',
        'method': 'GET',
        'parameters': parameters
      };

      OAuth.setTimestampAndNonce(message);

      (function() {
        Yelp.accessor.consumerSecret = Yelp.auth.consumerSecret;
        Yelp.accessor.tokenSecret = Yelp.auth.accessTokenSecret;

      })();

      OAuth.SignatureMethod.sign(message, Yelp.accessor);

      var parameterMap = OAuth.getParameterMap(message.parameters);
      parameterMap.oauth_signature = OAuth.percentEncode(parameterMap.oauth_signature);
      //console.log(parameterMap);

      $.ajax({
        'url': message.action,
        'data': parameterMap,
        'cache': true,
        'dataType': 'jsonp',
        'jsonpCallback': 'success',
        'success': function(data, textStats, XMLHttpRequest) {
          self.searchSuccess(data);
        }
      }).fail(function() {
        self.searchFail();
      });

    },

    self.searchSuccess = function(results) {
      if (!results) {
        self.searchFail();
        return;
      }

      yelpResults = results.businesses;
      self.resultList(results.businesses);
      var lngDelta = results.region.span.longitude_delta;
      var latDelta = results.region.span.latitude_delta;
      self.center({
        lat: results.region.center.latitude,
        lng: results.region.center.longitude
      });
      map.setCenter({
        lat: results.region.center.latitude,
        lng: results.region.center.longitude
      });
      //console.log("Searched for " + self.searchTerm() + " in " + self.searchLocation());
      //console.log("Number of Results: " + results.businesses.length);
      //console.log("Lat Delta is " + results.region.span.latitude_delta);
      //console.log("Lng Delta is " + results.region.span.longitude_delta);
      //console.log(results);
      var maxDelta = lngDelta > latDelta ? lngDelta : latDelta;
      self.maxRegionDelta(maxDelta);
      console.log(self.maxRegionDelta);
      setZoom();
      displayMarkers();
    };

  self.searchFail = function() {
    swal('Error!', 'Problem connecting wih Yelp!', 'error');
  };

  self.centerMap = function(zipCodeString) {
    if (!geocoder) return;
    geocoder.geocode({
      'address': zipCodeString
    }, function(results, status) {
      if (status == google.maps.GeocoderStatus.OK) {
        //Got result, center the map and put it out there
        map.setCenter(results[0].geometry.location);
        //console.log(results[0].geometry.location);
      } else {
        console.log("Geocode was not successful for the following reason: " + status);
      }
    });

  };

  // Sets the map on all markers in the array.
  self.setMapOnAll = function(map) {
    for (var i = 0; i < self.mapMarkers().length; i++) {
      self.mapMarkers()[i].setMap(map);
    }
  };

  // Removes the markers from the map, but keeps them in the array.
  self.clearMarkers = function() {
    setMapOnAll(null);
  };

  self.clearMarkerAnimations = function() {
    for (var i = 0; i < mapMarkers().length; i++) {
      mapMarkers()[i].setAnimation(null);
    }

  };

  self.hideInputWindow = function() {
    $('#informationWindow').hide('slow');
    $('#mobileButton').show('slow');
  };

  self.showInputWindow = function() {
    $('#informationWindow').show('slow');
    $('#mobileButton').hide('slow');
  };

  self.displayMarkers = ko.computed(function() {
    //hide any existing markers
    self.clearMarkers(null);
    for (var i = 0; i < self.filteredResultList().length; i++) {
      var result = self.filteredResultList()[i];
      var marker = new google.maps.Marker({
        position: {
          lat: result.location.coordinate.latitude,
          lng: result.location.coordinate.longitude
        },
        map: map,
        animation: google.maps.Animation.DROP,
        title: result.name
      });

      filteredResultList()[i].content = personalizeContent(result);
      filteredResultList()[i].marker = marker;

      (function(selectedResult, marker) {
        marker.addListener('click', function() {
          if (window.screen.width < 500) {
            self.hideInputWindow();
          }
          clearMarkerAnimations();
          marker.setAnimation(google.maps.Animation.BOUNCE);
          setTimeout(function() {
            marker.setAnimation(null);
          }, 1500);
          if (openWindow) {
            openWindow.close();
          }

          var infowindow = new google.maps.InfoWindow({
            content: personalizeContent(selectedResult)
          });
          infowindow.open(marker.map, marker);
          openWindow = infowindow;
          var latitude = selectedResult.location.coordinate.latitude;
          var longitude = selectedResult.location.coordinate.longitude;
          map.setCenter({
            lat: latitude,
            lng: longitude
          });
          console.log(selectedResult.name);
        });
      })(result, marker);

      self.mapMarkers().push(marker);
    }

  });

  self.adjustResultsListHeight = function() {

    var availableHeight = $(window).height() - parseInt($('#searchBar').css('height')) - 50;
    $('#resultsList').css('height', availableHeight);


  };


  self.listItemSelect = function(data, event) {
    var nameSelected = event.target.innerText;
    for (var i = 0; i < filteredResultList().length; i++) {
      if (nameSelected === filteredResultList()[i].name) {
        if (window.screen.width < 500) {
          self.hideInputWindow();
        }
        console.log(filteredResultList()[i]);
        var selectedResult = filteredResultList()[i];
        var selectedMarker = selectedResult.marker;
        var latitude = selectedResult.location.coordinate.latitude;
        var longitude = selectedResult.location.coordinate.longitude;
        if (openWindow) {
          openWindow.close();
        }
        var infowindow = new google.maps.InfoWindow({
          content: personalizeContent(selectedResult)
        });

        infowindow.open(selectedMarker.map, selectedMarker);
        selectedMarker.setAnimation(google.maps.Animation.BOUNCE);
        setTimeout(function() {
          selectedMarker.setAnimation(null);
        }, 1500);
        map.setCenter({
          lat: latitude,
          lng: longitude
        });
        openWindow = infowindow;
        console.log(filteredResultList()[i]);
      }
    }
  };

  self.swanson = function() {

    $.ajax({
      'url': 'http://ron-swanson-quotes.herokuapp.com/quotes',
      'data': '',
      'cache': false,
      'dataType': 'json',
      'callback': 'success',
      'success': function(data, textStats, XMLHttpRequest) {
        swal({
          title: "",
          text: data.quote,
          imageUrl: "assets/swanson.jpg"
        });
      }
    }).fail(function() {
      swal({
        title: "",
        text: "Ajax Error",
        imageUrl: "assets/swanson.jpg",
      });
    });

  };


};

ko.applyBindings(NeighborHoodMapViewModel);

function initializeMap() {

  geocoder = new google.maps.Geocoder();

  map = new google.maps.Map(document.getElementById('map'), {
    center: {
      lat: 45.375,
      lng: -122.633
    },
    disableDefaultUI: true,
    zoom: zoomLevel(),
  });

}

function personalizeContent(result) {
  var contentString = '<div id="resultsCards" class="mdl-shadow--8dp resultsCards">' +
    '<div class="card-wide mdl-card mdl-shadow--2dp">' +
    '<div class="mdl-card__title" style="background: url(%URL%) center / cover;">' +
    '<h2 class="mdl-card__title-text">%PARKNAME%</h2>' +
    '</div>' +
    '<div class="mdl-card__supporting-text">"%SNIPPET%"</div>' +
    '<div class="mdl-card__actions mdl-card--border">' +
    '<a href="%READMORE%" target="_blank" class="mdl-button mdl-button--colored mdl-js-button mdl-js-ripple-effect">' +
    'Read More' +
    '</a>' +
    '</div>' +
    '</div>' +
    '</div>';

  contentString = result.image_url ? contentString.replace("%URL%", result.image_url) : contentString.replace("%URL%", "");
  contentString = result.name ? contentString.replace("%PARKNAME%", result.name) : contentString.replace("%PARKNAME%", "");
  contentString = result.snippet_text ? contentString.replace("%SNIPPET%", result.snippet_text) : contentString.replace("%SNIPPET%", "");
  contentString = result.url ? contentString.replace("%READMORE%", result.url) : contentString.replace("%READMORE%", "");
  return contentString;

}

//var API_KEY = "AIzaSyDdiB_7OxmQOI61djUBR1Xwgr33x-h6XR8";