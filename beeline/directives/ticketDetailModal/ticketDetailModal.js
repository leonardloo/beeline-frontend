import ticketDetailModalTemplate from './ticketDetailModal.html'
import _ from 'lodash'

angular.module('beeline').directive('ticketDetailModal', [
  '$stateParams',
  'TicketService',
  'CompanyService',
  'TripService',
  'UserService',
  'RoutesService',
  'MapService',
  'MapOptions',
  'uiGmapGoogleMapApi',
  'MapViewFactory',
  function (
    $stateParams,
    TicketService,
    CompanyService,
    TripService,
    UserService,
    RoutesService,
    MapService,
    MapOptions,
    uiGmapGoogleMapApi,
    MapViewFactory
  ) {
    return {
      restrict: 'E',
      template: ticketDetailModalTemplate,
      scope: {
        ticketId: '@',
        modal: '=',
        functions: '=',
      },
      link: function (scope, element, attributes) {
        // ------------------------------------------------------------------------
        // Helper Functions
        // ------------------------------------------------------------------------

        const updateVehicleInfo = id => {
          TripService.getTripData(Number(id), true).then(trip => {
            scope.vehicleId = trip.vehicleId
            scope.disp.vehicle = _.get(trip, 'vehicle.vehicleNumber')
          })
        }

        const sentTripToMapView = () => {
          const trip = scope.trip
          if (trip) {
            MapService.emit('ping-trips', [trip])
            MapService.emit('startPingLoop')
            MapService.on('ping', updateIfVehicleChanged)
            MapService.on('status', updateStatus)
          }
        }

        const updateIfVehicleChanged = ping => {
          if (scope.vehicleId !== ping.vehicleId) {
            updateVehicleInfo(ping.tripId)
          }
        }

        const updateStatus = status => {
          scope.disp.tripStatus = status
        }

        const deregister = function () {
          MapService.emit('killPingLoop')
          MapService.removeListener('ping', updateIfVehicleChanged)
          MapService.removeListener('status', updateStatus)
        }

        const updateMapView = function updateMapView () {
          let coordinates = scope.ticket.boardStop.stop.coordinates.coordinates
          scope.modalMap.center = {
            latitude: coordinates[1],
            longitude: coordinates[0],
          }
        }

        // Called in RouteDetailController
        // Fixes off center map
        scope.functions.recenterMap = function (ticket) {
          ticketPromise.then(tkt => {
            ticket = ticket || tkt
            let coordinates = ticket.boardStop.stop.coordinates.coordinates
            // Refresh the center coordinates because the angular digest cycle
            // messes things up
            // See this github issue for more details
            // https://github.com/angular-ui/angular-google-maps/issues/1599
            gmapIsReady.then(() => {
              scope.modalControl.refresh({
                latitude: coordinates[1],
                longitude: coordinates[0],
              })
            })
          })
        }

        // ------------------------------------------------------------------------
        // Data Initialization
        // ------------------------------------------------------------------------

        scope.disp = {
          vehicle: null,
          tripStatus: null,
        }

        scope.vehicleId = null

        scope.modalMap = MapOptions.defaultMapOptions({
          zoom: 14,
          busLocation: {
            coordinates: null,
            icon: null,
          },
        })

        scope.modalControl = {}

        scope.ticketId = Number(scope.ticketId) || Number($stateParams.ticketId)

        scope.user = UserService.getUser()

        // ------------------------------------------------------------------------
        // Data Loading
        // ------------------------------------------------------------------------
        // Resolved when the map is initialized
        const gmapIsReady = new Promise((resolve, reject) => {
          let resolved = false
          scope.$watch('modalMap.control.getGMap', function () {
            if (scope.modalMap.control.getGMap) {
              if (!resolved) {
                resolved = true
                resolve()
              }
            }
          })
        })

        gmapIsReady.then(() => {
          MapOptions.disableMapLinks()
        })

        uiGmapGoogleMapApi.then(googleMaps => {
          scope.modalMap.busLocation.icon = {
            url: `img/busMarker.svg`,
            scaledSize: new googleMaps.Size(68, 86),
            anchor: new googleMaps.Point(34, 78),
          }
        })

        Promise.all([gmapIsReady, uiGmapGoogleMapApi]).then(
          ([ignore, googleMaps]) => {
            const gmap = scope.map.control.getGMap()
            google.maps.event.trigger(gmap, 'resize')
          }
        )

        MapViewFactory.init(scope)

        const recentTimeBound = 2 * 60 * 60000
        const pingLoop = MapViewFactory.pingLoop(scope, recentTimeBound)
        const statusLoop = MapViewFactory.statusLoop(scope)
        MapViewFactory.setupPingLoops(scope, pingLoop, statusLoop)

        const ticketPromise = TicketService.getTicketById(scope.ticketId)
        const tripPromise = ticketPromise.then(ticket => {
          return TripService.getTripData(Number(ticket.alightStop.tripId))
        })
        const routePromise = tripPromise.then(trip => {
          return RoutesService.getRoute(Number(trip.routeId))
        })
        const companyPromise = routePromise.then(route => {
          return CompanyService.getCompany(Number(route.transportCompanyId))
        })
        companyPromise.then(company => {
          scope.company = company
        })
        ticketPromise.then(ticket => {
          scope.mapObject.boardStop = ticket.boardStop
          scope.mapObject.alightStop = ticket.alightStop
          scope.ticket = ticket
          scope.trip = ticket.boardStop.trip
          scope.disp.tripStatus = scope.trip.status
          scope.tripCode = ticket.tripCode
          sentTripToMapView()
          updateVehicleInfo(ticket.boardStop.trip.id)
          updateMapView()
        })
        tripPromise.then(trip => {
          let stops = trip.tripStops.map(ts => {
            return _.assign(ts.stop, { canBoard: ts.canBoard })
          })
          scope.mapObject.stops = stops
        })
        routePromise.then(route => {
          scope.route = route
          if (route.path) {
            RoutesService.decodeRoutePath(route.path)
              .then(decodedPath => {
                scope.mapObject.routePath = decodedPath
              })
              .catch(() => {
                scope.mapObject.routePath = []
              })
          }
        })

        // ------------------------------------------------------------------------
        // UI Hooks
        // ------------------------------------------------------------------------

        scope.showTerms = companyId => {
          CompanyService.showTerms(companyId)
        }

        scope.closeModal = () => {
          deregister()
          scope.modal.hide()
        }

        // ------------------------------------------------------------------------
        // Event handlers
        // ------------------------------------------------------------------------

        // when leaving tabs.route-detail or tabs.ticket-detail
        scope.$on('$destroy', () => {
          deregister()
        })

        // when leaving tabs.my-booking-routes or tabs.route-detail
        scope.$on('leavingMyBookingRoute', (event, args) => {
          if (
            args.ticketId &&
            scope.ticket &&
            scope.ticket.id === args.ticketId
          ) {
            deregister()
          }
        })

        scope.$on('enteringMyBookingRoute', (event, args) => {
          sentTripToMapView()
        })
      },
    }
  },
])
