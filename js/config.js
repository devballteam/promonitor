'use strict'

;(function (document) {

  var formElement = document.getElementById('config')
  var inputs = formElement.querySelectorAll('[name]')

  ;[].forEach.call(inputs, input => {
    if (localStorage[input.name]) {
      input.value = localStorage[input.name]
    }
  })

  formElement.addEventListener('submit', function (event) {
    event.preventDefault()
    ;[].forEach.call(inputs, input => {
      localStorage[input.name] = input.value
    })
    location.href = "index.html"
  })

})(document)
