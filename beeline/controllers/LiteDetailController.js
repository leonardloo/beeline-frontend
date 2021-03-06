import { htmlFrom } from '../shared/util'
import _ from 'lodash'

export default [
  '$scope',
  '$ionicHistory',
  '$stateParams',
  '$ionicPopup',
  '$ionicLoading',
  'RoutesService',
  'LiteRoutesService',
  'LiteRouteSubscriptionService',
  'UserService',
  'loadingSpinner',
  'MapService',
  '$state',
  function (
    $scope,
    $ionicHistory,
    $stateParams,
    $ionicPopup,
    $ionicLoading,
    RoutesService,
    LiteRoutesService,
    LiteRouteSubscriptionService,
    UserService,
    loadingSpinner,
    MapService,
    $state
  ) {
    // ------------------------------------------------------------------------
    // Helper Functions
    // ------------------------------------------------------------------------
    /**
     * Send fake trip objects to MapService, to retrieve pings and statuses
     */
    const sendTripsToMapView = function sendTripsToMapView () {
      const dailyTripIds = $scope.book.dailyTripIds
      if (dailyTripIds && dailyTripIds.length > 0) {
        MapService.emit('ping-trips', dailyTripIds.map(id => ({ id })))
      }
    }

    /**
     * Refresh trip information
     * @param {Object} tripInfo - a payload from MapService, obtained from
     * the backend
     */
    const updateTripInfo = function updateTripInfo (tripInfo) {
      $scope.disp.hasTrackingData = tripInfo.hasTrackingData
      $scope.disp.statusMessages = tripInfo.statusMessages
      $scope.$digest()
    }

    // ------------------------------------------------------------------------
    // stateParams
    // ------------------------------------------------------------------------
    let label = $stateParams.label

    // ------------------------------------------------------------------------
    // Data Initialization
    // ------------------------------------------------------------------------
    $scope.disp = {
      companyInfo: {},
      hasTrackingData: null,
      statusMessages: null,
      showHamburger: null,
    }

    // Default settings for various info used in the page
    $scope.book = {
      label,
      route: null,
      waitingForSubscriptionResult: false,
      isSubscribed: false,
      dailyTripIds: [],
      inServiceWindow: false,
      hasTrips: true,
    }

    // Open the first bus stop by default
    $scope.current = 0

    // ------------------------------------------------------------------------
    // Data Loading
    // ------------------------------------------------------------------------
    let routePromise
    let subscriptionPromise

    routePromise = LiteRoutesService.fetchLiteRoute($scope.book.label)
    subscriptionPromise = LiteRouteSubscriptionService.isSubscribed(
      $scope.book.label
    )

    subscriptionPromise.then(response => {
      $scope.book.isSubscribed = response
    })

    routePromise.then(route => {
      $scope.book.route = route[$scope.book.label]

      // Sort the stops by the first departure time
      $scope.book.route.stops = _.orderBy(
        $scope.book.route.stops,
        ['time[0]'],
        ['asc']
      )

      $scope.disp.features = htmlFrom(route[$scope.book.label].features)
    })

    // ------------------------------------------------------------------------
    // Ionic events
    // ------------------------------------------------------------------------
    $scope.$on('$ionicView.enter', function () {
      if ($ionicHistory.backView()) {
        $scope.disp.showHamburger = false
      } else {
        $scope.disp.showHamburger = true
      }
    })

    $scope.$on('$ionicView.afterEnter', () => {
      // Must define leavePromise here because if we define
      // the handler for $ionicView.beforeLeave in .then(() => {})
      // the user might have already navigated away from the page, and
      // the event will not be fired
      const leavePromise = new Promise(resolve => {
        $scope.$on('$ionicView.beforeLeave', resolve)
      })

      sendTripsToMapView()

      const dataPromise = loadingSpinner(
        Promise.all([routePromise, subscriptionPromise]).then(() => {
          MapService.emit('startPingLoop')

          const listener = tripInfo => {
            updateTripInfo(tripInfo)
          }
          MapService.on('tripInfo', listener)
          leavePromise.then(() =>
            MapService.removeListener('tripInfo', listener)
          )
        })
      )

      Promise.all([dataPromise, leavePromise]).then(() => {
        MapService.emit('killPingLoop')
      })
    })

    // ------------------------------------------------------------------------
    // Watchers
    // ------------------------------------------------------------------------
    $scope.$watch('book.dailyTripIds', tripIds => {
      $scope.book.hasTrips = tripIds && tripIds.length > 0
    })

    $scope.$watch('book.dailyTripIds', sendTripsToMapView)

    $scope.$watch(
      () => UserService.getUser() && UserService.getUser().id,
      userId => {
        $scope.isLoggedIn = Boolean(userId)
      }
    )

    $scope.$watchCollection(
      () => [].concat(LiteRouteSubscriptionService.getSubscriptionSummary()),
      newValue => {
        LiteRouteSubscriptionService.isSubscribed($scope.book.label).then(
          response => {
            if (response) {
              $scope.book.isSubscribed = true
            } else {
              $scope.book.isSubscribed = false
            }
          }
        )
      }
    )

    // ------------------------------------------------------------------------
    // UI Hooks
    // ------------------------------------------------------------------------
    $scope.setSelected = function (index) {
      // If selecting the currently selected item, collapse all
      if (index === $scope.current) {
        $scope.current = null
        return
      }
      $scope.current = index
      let stop = $scope.book.route.stops[index]
      MapService.emit('stop-selected', stop)
    }

    $scope.showConfirmationPopup = async function () {
      let user = await UserService.loginIfNeeded()

      if (!user) {
        await $ionicPopup.alert({
          title: 'Login Required',
          template: `
            <div class="item item-text-wrap text-center ">
              <p>You are not logged in. Please login to bookmark this route.</p>
            </div>
          `,
        })
        return
      }

      if ($scope.book.isSubscribed) {
        $scope.promptUntrack()
      } else {
        const response = await $ionicPopup.confirm({
          title: 'Are you sure you want to bookmark this route?',
        })

        if (!response) return
        $scope.followRoute()
      }
    }

    $scope.followRoute = async function () {
      try {
        $scope.book.waitingForSubscriptionResult = true

        const subscribeResult = await loadingSpinner(
          LiteRoutesService.subscribeLiteRoute($scope.book.label)
        )

        if (subscribeResult) {
          $scope.book.isSubscribed = true
          $ionicPopup
            .alert({
              title: 'Success',
              template: `
            <div class="item item-text-wrap text-center ">
              <div>
                <img src="img/lite_success.svg">
              </div>
              <p>You bookmarked this route.<br>
              Track your bus on the day of the trip.
              </p>
            </div>
            `,
            })
            .then(() => {
              $state.transitionTo('tabs.yourRoutes')
            })
        }
      } catch (err) {
        await $ionicLoading.show({
          template: `
          <div>Error, please try again later.</div>
          `,
          duration: 1000,
        })
      } finally {
        $scope.book.waitingForSubscriptionResult = false
      }
    }

    // TODO: Move bulk of promptUntrack code into service or directive as both
    // LiteSummaryController and LiteRouteTrackerController uses it
    $scope.promptUntrack = async function () {
      const response = await $ionicPopup.confirm({
        title: 'Are you sure you want to unbookmark this route?',
        subTitle:
          'This tracking-only route will be removed from ' + 'your trips list.',
      })

      if (!response) return

      try {
        $scope.book.waitingForSubscriptionResult = true

        const unsubscribeResult = await loadingSpinner(
          LiteRoutesService.unsubscribeLiteRoute($scope.book.label)
        )

        if (unsubscribeResult) {
          $scope.book.isSubscribed = false
        }

        if (!$scope.book.isSubscribed) {
          await $ionicLoading.show({
            template: `
            <div>Done!</div>
            `,
            duration: 1000,
          })
          $ionicHistory.goBack()
        }
      } catch (err) {
        await $ionicLoading.show({
          template: `
          <div>Error, please try again later.</div>
          `,
          duration: 1000,
        })
      } finally {
        $scope.book.waitingForSubscriptionResult = false
      }
    }
  },
]
