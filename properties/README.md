# Properties

Properties are site-specific values that may be accessed anywhere in your bundle.

Properties are accessible via `getProperties()` through the `fusion:properties` import. This object will include all global properties, as well as extra or overridden site-specific values for the current site.

## Global values

Global values should be defined in `properties/index.js` (or `properties/index.json` if you don't need to compute any values). These values will be the defaults and will be included for all sites, unless explicitly overridden.

## Site-Specific values

Site-specific values should be defined in `properties/sites/${site}.js` (or `properties/sites/${site}.json` if you don't need to compute any values). These values will override any global values when the site is loaded.

## Example

`properties/index.json`
```json
{
  "myProperty": "global"
}
```

`properties/sites/site1.json`
```json
{
  "myProperty": "site1"
}
```

`components/features/component.jsx`
```js
import getProperties from 'fusion:properties'

const MyComponent = (props) => {
  const { arcSite } = props
  const { myProperty } = getProperties(arcSite)

  return <div>{myProperty}</div>
}

export default MyComponent
```

When used in `site1`, the result will be `<div>site1</div>`; otherwise, it will be `<div>global</div>`
