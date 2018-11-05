'use strict'

;(function (document) {

  var config = localStorage.config
  var pullRequestsListElement = document.getElementById('pull-requests-list')

  /**
   * GET request for JSON data
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
   */
  function queryGitHub (query, callback) {
    getJSON('https://api.github.com' + query + '?access_token=' + config.token, callback)
  }

  /**
   * Handle rendering and updating PR
   */
  function handlePullRequest (data, defaultBranch, refreshTime) {
    var pullRequestElement = document.createElement('li')
    var authorAvatarElement = document.createElement('img')
    var mainLinkElement = document.createElement('a')
    var reviewersListElement = document.createElement('ul')
    var reviewersElements = {}
    var pullRequestTimer = new Timer(pullRequestElement)

    var query = '/repos/' + data.base.repo.full_name +
                '/pulls/' + data.number

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

    pullRequestElement.appendChild(authorAvatarElement)
    pullRequestElement.appendChild(mainLinkElement)
    pullRequestElement.appendChild(reviewersListElement)
    pullRequestsListElement.appendChild(pullRequestElement)

    pullRequestElement.classList.add('pull-request')
    authorAvatarElement.classList.add('author-avatar')
    mainLinkElement.classList.add('main-link')
    reviewersListElement.classList.add('reviewers-list')

    data.requested_reviewers.forEach(function (reviewer) {
      addReviewer(reviewer)
    })

    pullRequestElement.dataset.base = data.base.ref
    authorAvatarElement.src = data.user.avatar_url
    authorAvatarElement.title = data.user.login
    mainLinkElement.href = data.html_url
    mainLinkElement.textContent = data.title
    mainLinkElement.target = '_blank'

    // TODO add setting for each repository
    if (data.base.ref !== defaultBranch) {
      pullRequestElement.classList.add('branch-warning')
    }

    ;(function update () {
      // Get all reviews
      queryGitHub(query + '/reviews', function (reviews) {
        // Get only last reviews (user login as key in 'reviews'object)
        reviews = reviews.reduce(function (acc, review) {
          if (review.user.login !== data.user.login && // omit PR author
              (!acc[review.user.login] || // add new reviewer to acc
              review.state !== 'COMMENTED')) { // update existing reviewer
            acc[review.user.login] = review
          }

          return acc
        }, {})

        // Get all commits
        queryGitHub(query + '/commits', function (commits) {
          // Last commit date
          var commitDate = new Date(commits.pop().commit.committer.date)

          Object.keys(reviews).forEach(function (login) {
            var reviewDate = new Date(reviews[login].submitted_at)

            if (!reviewersElements[login]) addReviewer(reviews[login].user)
            reviewersElements[login].dataset.state = reviews[login].state
            reviewersElements[login].dataset.old = commitDate - reviewDate > 0
          })

          queryGitHub(query, function (newPullRequestData) {
            mainLinkElement.textContent = newPullRequestData.title

            newPullRequestData.requested_reviewers.forEach(function (reviewer) {
              if (!reviewersElements[reviewer.login]) addReviewer(reviewer)
            })

            // Remove pull request if status is not 'open'
            if (newPullRequestData.state === 'open') {
              setTimeout(update, refreshTime)
              pullRequestTimer.set(refreshTime / 1000)
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
    var listTimer = new Timer(document.querySelector('header [data-timer]'))

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
        queryGitHub('/repos/' + repo.fullName + '/pulls', function (repoPulls) {
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

      setTimeout(update, config.refreshTime)
      listTimer.set(config.refreshTime / 1000)
    })()
  }

  init()

})(document)
