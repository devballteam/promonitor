'use strict'

;(function (document) {

  var formElement = document.getElementById('config')
  var textareaElement = formElement.querySelector('textarea')

  if (localStorage.config) textareaElement.value = localStorage.config

  formElement.addEventListener('submit', function (event) {
    event.preventDefault()
    localStorage.config = textareaElement.value
    location.href = "index.html"
  })

})(document)
