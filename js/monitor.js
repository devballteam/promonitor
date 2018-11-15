'Use strict'

;(function (document) {

  var config = localStorage.config
  var pullRequestsListElement = document.getElementById('pull-requests-list')

  /**
   * GET request for JSON data
   * @param {String} url
   * @param {Function} callback
   */
  function getJSON (url, callback) {
    var request = new XMLHttpRequest()
    request.onload = function () {
      if (request.status === 200) callback(JSON.parse(request.responseText))
      else console.error('getJSON status !== 200', url, request)
    }
    request.open('GET', url, true)
    request.send(null)
  }

  /**
   * Send request query to github api
   * @param {String} query
   * @param {String} params - params as query string
   * @param {Function} callback
   */
  function queryGitHub (query, params, callback) {
    getJSON('https://api.github.com' + query +
            '?access_token=' + config.token +
            params || '', callback)
  }

  /**
   * Handle rendering and updating PR
   */
  function handlePullRequest (data, defaultBranch, refreshTime) {
    var pullRequestElement = document.createElement('li')
    var authorAvatarElement = document.createElement('img')
    var mainDataContainerElement = document.createElement('span')
    var mainLinkElement = document.createElement('a')
    var additionalDataContainerElement = document.createElement('div')
    var createdTimeElement = document.createElement('span')
    var repoLinkElement = document.createElement('a')
    var updatedTimeElement = document.createElement('span')
    var reviewersListElement = document.createElement('ul')
    var ticketLinkElement // created later if ticket id exist in PR title
    var reviewersElements = {}
    var pullRequestTimer = new Timer()
    var createdTimeTimer = new Timer()
    var updatedTimeTimer = new Timer()

    // All future queries for this PR will start with this string
    var query = '/repos/' + data.base.repo.full_name +
                '/pulls/' + data.number

    /**
     * Create element for given reviewer and add it to reviewersList
     * for future updates
     * @pram {Object} reviewer - reviewer data from github api
     */
    function addReviewer (reviewer) {
      var listElement = document.createElement('li')
      var avatarElement = document.createElement('img')

      avatarElement.src = reviewer.avatar_url
      avatarElement.title = reviewer.login

      avatarElement.classList.add('reviewer-avatar')
      listElement.classList.add('reviewer')
      listElement.appendChild(avatarElement)
      reviewersListElement.appendChild(listElement)

      reviewersElements[reviewer.login] = listElement
    }

    /**
     * Check if given title starts with ticket id.  If yes then parse it,
     * create link element (if don't already exist) and update element value
     * with direct link to JIRA ticket with that id.
     * @param {String} title - PR title
     */
    function parseTicketId (title) {
      var ticketId = title.match(/^(.+?[- ]\d+)/)

      if (ticketId) {
        ticketId = ticketId[0].replace(' ', '-').toUpperCase().trim()

        if (!ticketLinkElement) {
          ticketLinkElement = document.createElement('a')
          ticketLinkElement.textContent = 'JIRA'
          ticketLinkElement.classList.add('ticket-link')
          ticketLinkElement.classList.add('button')
          ticketLinkElement.target = '_blank'
          mainDataContainerElement.insertBefore(ticketLinkElement, mainLinkElement)
        }

        ticketLinkElement.style.display = 'inline'
        ticketLinkElement.title = 'go to ticket ' + ticketId
        ticketLinkElement.href = 'https://jira2.performgroup.com/browse/' + ticketId
      } else if (ticketLinkElement) {
        // Ticket link already exist but new title don't have proper ticket id
        // so link element is hidden.
        ticketLinkElement.style.display = 'none'
      }
    }

    /**
     * Calculate difference between given date and current date
     * @param {String} date - Date in string format
     * @return {Number} Difference in dates in milliseconds
     */
    function getTimeSince (date) {
      return (new Date()) - (new Date(date))
    }

    // Combine all elements in main pullRequestElement
    pullRequestElement.appendChild(authorAvatarElement)
    pullRequestElement.appendChild(mainDataContainerElement)
    pullRequestElement.appendChild(reviewersListElement)
    mainDataContainerElement.appendChild(mainLinkElement)
    mainDataContainerElement.appendChild(additionalDataContainerElement)
    additionalDataContainerElement.appendChild(createdTimeElement)
    additionalDataContainerElement.appendChild(repoLinkElement)
    additionalDataContainerElement.appendChild(updatedTimeElement)
    pullRequestsListElement.appendChild(pullRequestElement)

    // Fill elements with classes
    pullRequestElement.classList.add('pull-request')
    authorAvatarElement.classList.add('author-avatar')
    mainDataContainerElement.classList.add('main-data-container')
    mainLinkElement.classList.add('main-link')
    additionalDataContainerElement.classList.add('additional-data-container')
    createdTimeElement.classList.add('created-time')
    repoLinkElement.classList.add('repo-link')
    updatedTimeElement.classList.add('updated-time')
    reviewersListElement.classList.add('reviewers-list')

    // Add initial requested reviewers list
    data.requested_reviewers.forEach(function (reviewer) {
      addReviewer(reviewer)
    })

    // Fill static and initial data
    pullRequestElement.dataset.base = data.base.ref
    authorAvatarElement.src = data.user.avatar_url
    authorAvatarElement.title = data.user.login
    mainLinkElement.href = data.html_url
    mainLinkElement.textContent = data.title
    mainLinkElement.target = '_blank'
    repoLinkElement.href = data.base.repo.html_url
    repoLinkElement.textContent = data.base.repo.full_name
    repoLinkElement.target = '_blank'
    parseTicketId(data.title)

    // Run timer for time of PR creation
    createdTimeTimer.start(true, getTimeSince(data.created_at), function (time) {
      createdTimeElement.textContent = time
    })

    ;(function update () {
      // Get all reviews
      queryGitHub(query + '/reviews', '&page=1&per_page=9000', function (reviews) {
        // Get only last reviews ('user.login' as key in 'reviews' object)
        reviews = reviews.reduce(function (acc, review) {
          if (review.user.login !== data.user.login && // omit PR author
              (!acc[review.user.login] || // add new reviewer to acc
              review.state !== 'COMMENTED')) { // update existing reviewer
            acc[review.user.login] = review
          }

          return acc
        }, {})

        // Get all commits
        queryGitHub(query + '/commits', '', function (commits) {
          var commitDate = new Date(commits.pop().commit.committer.date) // Last commit date

          // Update state of each review and check if review is old
          Object.keys(reviews).forEach(function (login) {
            var reviewDate = new Date(reviews[login].submitted_at)

            if (!reviewersElements[login]) addReviewer(reviews[login].user)
            reviewersElements[login].dataset.state = reviews[login].state
            reviewersElements[login].dataset.old = commitDate - reviewDate > 0
          })

          // Check if all reviewers approved PR
          pullRequestElement.dataset.ready =
            Object.keys(reviewersElements).length && // There is at least one reviewer
            !Object.keys(reviewersElements).some(function (login) {
              var dataset = reviewersElements[login].dataset
              return dataset.state !== 'APPROVED' || dataset.old === 'true'
            })

          // Get new main PR data
          queryGitHub(query, '', function (newData) {
            mainLinkElement.textContent = newData.title // update PR title
            parseTicketId(data.title)                   // update ticket link

            // Update timer value for 'updated time' data
            updatedTimeTimer.start(true, getTimeSince(newData.updated_at), function (time) {
              updatedTimeElement.textContent = time
            })

            // Update requested reviewers list
            newData.requested_reviewers.forEach(function (reviewer) {
              if (!reviewersElements[reviewer.login]) addReviewer(reviewer)
            })

            // Update wrong branch warning
            pullRequestElement.classList[newData.base.ref === defaultBranch ? 'remove' : 'add']('branch-warning')

            // Run timer for update if PR is still open
            // Else break update loop and remove Pull Request
            if (newData.state === 'open') {
              pullRequestTimer.start(false, refreshTime, function (time) {
                pullRequestElement.dataset.timer = time
              }, update)
            } else {
              pullRequestsListElement.removeChild(pullRequestElement)
            }
          })
        })
      })
    })()
  }

  /**
   * Initialize promonitor using config
   */
  function init () {
    var watchedPullRequests = []
    var listTimerElement = document.querySelector('header [data-timer]')
    var listTimer = new Timer()

    if (!config) {
      location.href = 'config.html'
      return
    }

    try {
      config = JSON.parse(config)
    } catch (error) {
      location.href = 'config.html#parse-error'
      return
    }

    (function update () {
      console.log('updating list of pull requests')

      config.repos.forEach(function (repo) {
        queryGitHub('/repos/' + repo.fullName + '/pulls', '', function (repoPulls) {
          repoPulls.forEach(function (pullRequestData) {
            var pullRequestKey = repo.fullName + '/' + pullRequestData.number

            if (!~watchedPullRequests.indexOf(pullRequestKey)) {
              watchedPullRequests.push(pullRequestKey)
              handlePullRequest(
                pullRequestData,
                repo.defaultBranch || config.defaultBranch,
                repo.refreshTime || config.refreshTime
              )
            }
          })
        })
      })

      listTimer.start(false, config.refreshTime, function (time) {
        listTimerElement.dataset.timer = time
      }, update)
    })()
  }

  init() // run promonitor

})(document)
