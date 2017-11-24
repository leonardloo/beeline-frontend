import {SafeInterval} from '../SafeInterval'
import {formatTime, formatTimeArray} from '../shared/format'
import _ from 'lodash'

export default [
  '$scope',
  'SharedVariableService',
  '$stateParams',
  'RoutesService',
  'MapService',
  '$timeout',
  'TripService',
  'TicketService',
  'ServerTime',
  function(
    $scope,
    SharedVariableService,
    $stateParams,
    RoutesService,
    MapService,
    $timeout,
    TripService,
    TicketService,
    ServerTime
  ) {
    let ticketId = $stateParams.ticketId ? Number($stateParams.ticketId) : null
    // Date calculated as Date.now() + Local-Server-TimeDiff

    const originalMapObject = {
      stops: [],
      routePath: [],
      alightStop: null,
      boardStop: null,
      pingTrips: [],
      allRecentPings: [],
      chosenStop: null,
      statusMessages: [],
    }

    $scope.mapObject = _.assign({}, originalMapObject)

    $scope.disp = {
      popupStop: null,
      routeMessage: null,
    }

    $scope.closeWindow = function() {
      $scope.disp.popupStop = null
    }

    $scope.applyTapBoard = function(stop) {
      $scope.disp.popupStop = stop
      $scope.$digest()
    }

    $scope.formatStopTime = function(input) {
      if (Array.isArray(input)) {
        return formatTimeArray(input)
      }
      return formatTime(input)
    }

    if (ticketId) {
      const ticketPromise = TicketService.getTicketById(ticketId)
      const tripPromise = ticketPromise.then((ticket) => {
        return TripService.getTripData(Number(ticket.alightStop.tripId))
      })
      const routePromise = tripPromise.then((trip) => {
        return RoutesService.getRoute(Number(trip.routeId))
      })
      ticketPromise.then((ticket) => {
        $scope.mapObject.boardStop = ticket.boardStop
        $scope.mapObject.alightStop = ticket.alightStop
        SharedVariableService.setBoardStop(ticket.boardStop)
        SharedVariableService.setAlightStop(ticket.alightStop)
      })
      tripPromise.then((trip) => {
        let stops = trip.tripStops.map((ts) => {
          return _.assign(ts.stop, {canBoard: ts.canBoard})
        })
        $scope.mapObject.stops = stops
        SharedVariableService.setStops(stops)
      })
      routePromise.then((route) => {
        if (route.path) {
          RoutesService.decodeRoutePath(route.path)
            .then((decodedPath) => {
              $scope.mapObject.routePath = decodedPath
            })
            .catch(() => {
              $scope.mapObject.routePath = []
            })
        }
      })
    }

    MapService.once('ping-single-trip', (trips) => {
      $scope.mapObject.pingTrips = trips
    })

    // fetch driver pings every 4s
    $scope.timeout = new SafeInterval(pingLoop, 4000, 1000)

    MapService.once('killTicketPingLoop', () => {
      $scope.timeout.stop()
    })

    MapService.once('startTicketPingLoop', () => {
      $scope.timeout.start()
    })

    // load icons and path earlier by restart timeout on watching trips
    $scope.$watchCollection('mapObject.pingTrips', (pt) => {
      if (pt) {
        $scope.timeout.stop()
        $scope.timeout.start()
      }
    })

    async function pingLoop() {
      if (!$scope.mapObject.pingTrips) return

      $scope.mapObject.statusMessages = $scope.mapObject.statusMessages || []
      $scope.mapObject.allRecentPings = $scope.mapObject.allRecentPings || []

      $scope.mapObject.statusMessages.length =
        $scope.mapObject.allRecentPings.length =
        $scope.mapObject.pingTrips.length

      await Promise.all($scope.mapObject.pingTrips.map((trip, index) => {
        return TripService.driverPings(trip.id)
        .then((info) => {
          const ticketInfo = {
            tripCode: info && info.code,
            vehicle: info &&
                     info.trip &&
                     info.trip.vehicle &&
                     info.trip.vehicle.vehicleNumber,
            driver: info &&
                    info.trip &&
                    info.trip.tripDriver &&
                    info.trip.tripDriver.name,
            tripStatus: info && info.trip && info.trip.status,
          }
          MapService.emit('ticketInfo', ticketInfo)
          const now = ServerTime.getTime()

          $scope.mapObject.allRecentPings[index] = {
            ...info,
            isRecent: info.pings[0] &&
              (now - info.pings[0].time.getTime()) < 2 * 60 * 60000,
          }

          $scope.mapObject.statusMessages[index] = _.get(info,
                                                         'statuses[0].message',
                                                         null)
        })
      }))
    }
  },
]
