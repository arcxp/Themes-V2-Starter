import React from 'react'
import PropTypes from 'prop-types'

const HelloWorld = (props) => {
  const { name = 'World' } = props.customFields
  return (
    <h1>Hello {name}!</h1>
  )
}

HelloWorld.propTypes = {
  customFields: PropTypes.shape({
    name: PropTypes.string
  })
}

HelloWorld.label = 'Hello World - Custom Block'

export default HelloWorld
