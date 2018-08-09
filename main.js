(function () {
  const reviewers = config.reviewers;
  const repos = new Map([...config.repositories]);
  let reviewersAvatars = {};
  let checkingInterval;

  /**
   *  @description  Make request to github API with passed query and with access
   *                token. Request is parsed from JSON to object.
   *  @param   {String}  query  GitHub API query
   *  @return  {Promise}        Promise which returns object with parsed
   *                            response.
   */
  function makeApiRequest (query) {
    return fetch(`https://api.github.com${query}?access_token=${config.token}`).then(response => response.json());
  };

  
  /**
   *  @description  Get pull requests for passed repositiory.
   *  @param   {String}   repo  full repository name e.g. user/test
   *  @return  {Promise}        Promise which returns object with parsed
   *                            response.
   */
  function getPullRequests (repo) {
    return makeApiRequest(`/repos/${repo}/pulls`);
  };

  /**
   *  @description  Get review for passed repositiory and pull request.
   *  @param   {String}   repo               full repository name e.g. user/test
   *  @param   {String}   pullRequestNumber  pull request number
   *  @return  {Promise}                     Promise which returns object with
   *                                         parsed response.
   */
  function getReview (repo, pullRequestNumber) {
    return makeApiRequest(`/repos/${repo}/pulls/${pullRequestNumber}/reviews`);
  };

  /**
   *  @description  Get reviewer data.
   *  @param   {String}   login  GitHub user login.
   *  @return  {Promise}         Promise which returns object with parsed
   *                             response.
   */
  function getReviewer (login) {
    return makeApiRequest(`/users/${login}`);
  };

  /**
   *  @description  Return time from passed date.
   *  @param   {Object}  utcDate  Date in UTC
   *  @return  {String}           String described time from passed time.
   */
  function convertDate (utcDate) {
    const time = Math.round((new Date().getTime() - new Date(utcDate).getTime()) / 1000);
    let lastUpdateTime = '';

    if (time < 60) {
      return time + ' s'
    } else if (time < 3600) {
      return Math.round(time / 60) + ' minutes ago'
    } else if (time < 86400) {
      return Math.round(time / 3600) + ' hours ago'
    } else {
      return Math.round(time / 86400) + ' days ago'
    }
  };

  /**
   *  @description  Return last state of review.
   *  @param   {Object}   reviewer  Reviewer object of pull request.
   *  @param   {Object}   review    Review for of pull request
   *  @return  {String}             Last review state
   */
  function reviewState (reviewer, review) {
    if (reviewer && reviewer.state) {
      return (reviewer.state === 'CHANGES_REQUESTED' || reviewer.state === 'APPROVED') && review.state === 'COMMENTED' ? reviewer.state : review.state;
    } else {
      return review.state;
    }
  };

  /**
   *  @description  Object with required reviewers for this  repository with
   *                their avatars.
   *  @param   {String}  repoName  full repository name e.g. user/test
   *  @param   {String}  author    GitHub user login.
   *  @return  {Object}            Object with required reviewers for this
   *                               repository with their avatars.
   */
  function getReviewers (repoName, author) {
    return repos.get(repoName).reduce((acc, user) => {
      user !== author && (acc[user] = { avatar: reviewersAvatars[user] });
      return acc;
    }, {});
  };

  /**
   *  @description  Add status, last action and last action time for each
   *                reviewer. Add not defined reviewers if they put review.
   *                their avatars.
   *  @param   {Array}   reviews   reviews for pull request
   *  @param   {String}  repoName  full repository name e.g. user/test
   *  @param   {String}  author    GitHub user login.
   *  @return  {Object}            Object with required reviewers and state of
   *                               thier review.
   */
  function processReviews (reviews, repoName, author) {
    return reviews.reduce((acc, review) => {
      //Add non defined reviewer
      if (!acc[review.user.login] && review.user.login !== author) {
        acc[review.user.login] = { avatar: reviewersAvatars[review.user.login] };
      }

      //Update
      if (acc[review.user.login]) {
        acc[review.user.login].state = reviewState(acc[review.user.login], review);
        acc[review.user.login].last_action_at = review.submitted_at;
        acc[review.user.login].last_action = review.state;
      }

      return acc;
    }, getReviewers(repoName, author));
  };

  
  /**
   *  @description  Get avatars of all reviewers.
   *  @return  {Promise}  Promise which update reviewers object with links to 
   *                      avatars.
   */
  function getAllAvatars () {
    return Promise.all(reviewers.map(getReviewer))
      .then(reviewers => reviewers.forEach((reviewer) => { reviewersAvatars[reviewer.login] = reviewer.avatar_url }));
  };

  
  /**
   *  @description  Get all pull requests and reviews for all of them.
   *  @return  {Promise}  Promise which returns array of objects with pull
   *                      pull request data and review status.
   */
  function getAllPullRequests () {
    let pullRequestsData;

    //Get pull requests for each repo
    return Promise.all([...repos].map(([repo]) => getPullRequests(repo)))
      //Flat array with all pull requests for each repo and aasign it to variable
      .then(pullRequestsPerRepo => {
        pullRequestsData = [].concat.apply([], pullRequestsPerRepo);
        return pullRequestsData;
      })
      //Get all reviews for each pull request for each repo
      .then(pullRequests => Promise.all(pullRequests.map((pullRequest) => getReview(pullRequest.base.repo.full_name, pullRequest.number))))
      //Assign reviews to pull request object for each pull request for each repo
      .then(reviews => pullRequestsData.map((pullRequest, i) => {
          pullRequest.processedReviews = processReviews(reviews[i], pullRequest.base.repo.full_name, pullRequest.user.login);
          //pullRequest.reviews = reviews[i];
          return pullRequest;
        }));
  };

  /**
   *  @description  Render data and add it to HTML
   *  @param  {Array}  dataToRender  Processed data from GitHub API
   */
  function renderedData (dataToRender) {
    let html = '';

    dataToRender.forEach(data => { html += renderPullRequest(data); });
    document.querySelector('section').innerHTML = html;
  };

  /**
   *  @description  Render reviewers.
   *  @param   {Object}  reviewers  Object with reviewers and state of review.
   *  @return  {String}            String with HTML code
   */
  function renderReviewers (reviewers) {
    return Object.keys(reviewers).reduce((acc, key) => {
      const reviewer = reviewers[key];
      const state = (reviewer.state || 'none').toLowerCase();
      const lastAction = reviewer.last_action && reviewer.last_action === 'COMMENTED' ? '&#128172;' : '';
      const lastActionDate = reviewer.last_action_at ? new Date(reviewer.last_action_at) : '';

      return acc += `<div class="reviewer">
          <img class="reviewer" src="${reviewer.avatar}" width="50">
          <i class="${state}"></i>
          <span class="last">
            ${reviewer.last_action_at ? convertDate(reviewer.last_action_at) : ''}${lastAction}
          </span>
        </div>`;
    },'');
  }

  /**
   *  @description  Render single pull request.
   *  @param   {Object}  pr  Object with pull request data
   *  @return  {String}      String with HTML code
   */
  function renderPullRequest (pr) {
    return `<div class="row">
      <div class="cell" >
        <img src="${pr.user.avatar_url}">
      </div>
      <div class="cell" >
        <a href="${pr.html_url}">${pr.title}</a>
        <i class="arrow">&#8674;</i>
        <span class="base">${pr.base.ref}</span>
        <div>
            <span class="repo">Repo:</span>
            <a href="${pr.base.repo.html_url}">${pr.base.repo.name}</a>
            <span class="last-update">Last update:</span>${convertDate(pr.updated_at)}
        </div>
      </div>
      <div class="cell reviewers">
        ${renderReviewers(pr.processedReviews)}
      </div>
    </div>`;
  };

  /**
   *  @description  Render list of repositories
   *  @return  {String}      String with HTML code
   */
  function renderReposList () {
    const githubUrl = 'https://github.com';
    let reposList = '<ul>';

    repos.forEach((reviewers, repo) => {
      reposList += `<li><a href="${githubUrl}/${repo}">${repo}</a></li>`;
    });
    reposList += '</ul>';
    return reposList;
  };

  /**
   *  @description  Toggle displaying list of repositories.
   */
  function toggleReposList () {
    const reposList = document.querySelector('div.repos-list > ul');

    if (reposList) {
      reposList.remove();
    } else {
      document.querySelector('div.repos-list').innerHTML += renderReposList();
    }
  };

  //Initial get reviewers avatars and pull requests.
  getAllAvatars()
  .then(getAllPullRequests)
  .then(renderedData);

  //Handle click
  document.querySelector('button.repos-list').addEventListener('click', toggleReposList);

  //Set checking interval
  checkingInterval = setInterval(() => {
    console.log('Refresh');
    getAllPullRequests().then(renderedData);
  }, config.intervalTimeInMinutes * 1000 * 60);

})();
