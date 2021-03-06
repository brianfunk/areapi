[![areAPI](https://img.shields.io/badge/-areAPI-db968f.svg?colorA=0c7ddc&logo=data%3Aimage%2Fpng%3Bbase64%2CiVBORw0KGgoAAAANSUhEUgAAABgAAAATCAYAAACKsM07AAAABmJLR0QA%2FwD%2FAP%2BgvaeTAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAAB3RJTUUH4QMQBDYHFgTjwgAABDhJREFUOMuVlUtsVFUYx3%2Fnvu%2FM3Hl12qYvph1apYChIlGEYDVGIybElbJz5ZaVO2UhJqxcuTBGQ9xpWGjighjfgY1IQiMYqrUCpaUdWqad9%2BPOvTP3uBhoCxTFL%2Fk2J%2Bf8%2F%2Bd83%2Fl%2FfxE%2B%2FrfkEUIgMTXBaFhyrejhKhZSSkACYosTnXXlX0GFQAiBrcFYt8GJwz18MmmzO1HcAuz%2B7IR276bN4ApK0GIwofHyuMOre7owhCBys8TJ7XGOzXrMVo3O22TwkCvKzQQbwAAjMYX96TAvjllEYhGCQGJQoSt8g9SQzZuNBu%2F%2FJWi24whhP5RE21xlIQRSBb8%2FQny7zeSIyWONG2BJhAxIeXPEe2q4TZfDZYO49PjFy%2FHVwjDNVnRLEuVurRUC7JQg2OngjThc1C3iYo7dyWXEtSnG1Vkcmafi6wQEjCRivNGzi3cHRjg9rpNQ%2FC2bvd7kWF8Id6Ifvz9F2vb5rG%2BGZ8U8rlujP1RDCxqYho6iqoDGWtND1SFldLO3x%2BH4NonBgx9SEcDOPoXekSYVTJ7Rcnw9OM1R5zYJW8UOmaQG4rTWCtQDA9f1Kc5p3DrZT%2FYLAzdfRfMVjg7oDNj%2BnR6K9VTiEQV%2Fr8MfTg%2BoghciZSbsMk0paAiDtqKRK%2FpMrXjkcnmEaGPWbRrnkyx%2B2kXtpy4soSFNjROjJhkrQIiNUimZbp0rQRJXcQjjUy75ZHM%2BlYrg7MIcV3NZVoMyv2m3yDgS4UpWzsQoFXzqVpP5yy5Fbxo98x1HMlk%2BGNUZVH3iaudjaCvFNqPlPGW9zZKS5PtImtcdl4PGGkopYLZQpKWpvDT0OFfiFu2VJk1d4gyqBFmLeCqHseMCXq%2BPH7rOPm%2BSU1aCpbrJW5dMtKViG%2Bv8GmPjklK6l5mmxqlSHyJcpyvikIkOUkwazGVrGGVJtF%2BBV5YpfT6M0Ft4ukTKFqpoYEY9lAM%2FM7awjezVbqTxNKr%2B3LH32qg0agZjoQBTwtWGxu0q7LA8grCkHhIYGihagGKH0QrTJPLncVd3UmvHiB6ahVQLr25Sd3VKbpW3z%2B0hV3c6QpMyoFKTLFzKo1kqTQE%2FSIWl6CB7hiWv7S8RsmsIYWFU5hm6%2FRHagRaVWprCzYMUpnvpznhI6aNaHqf%2FHGEmP7R5VAgkUGkJqG6ocaqqcXkZLix0c%2FjJLo7smsG5%2Fg1efp5C9XlkyyF6PYm9GMYx12gbNourBh9e2H%2B%2F0DoCkVI%2BkH5bMr0oubHsogsd341ihhMMhM4Sb%2F1ONZ5j%2Bdde5qcSVLMB73z7FF5g3Bnl6wTiP%2F1gbmWNmaU1mrsPUdf7WE1P4E3GcNQY59oZrrT6mXEtflwYXgcHEI9iOKIzsBhKtplI10kGVQ6MlhkdhzNnYnx8qZuGVNgRXWSm1AdC%2FX8Emw3objyRDtiXrvLlRYtK3dhwAHkv3D8kB9nlCOSKGAAAAABJRU5ErkJggg%3D%3D)](https://areapi.herokuapp.com/api/cma/1990/find?latitude=38.9907&longitude=-77.0261&format=json)
[![Semver](https://img.shields.io/badge/SemVer-2.0-blue.svg)](http://semver.org/spec/v2.0.0.html)
[![license](https://img.shields.io/github/license/mashape/apistatus.svg?maxAge=2592000)](https://opensource.org/licenses/MIT)
[![Open Source Love](https://badges.frapsoft.com/os/v1/open-source.svg?v=103)](https://github.com/ellerbrock/open-source-badge/)
[![LinkedIn](https://img.shields.io/badge/Linked-In-blue.svg)](https://www.linkedin.com/in/brianrandyfunk)

# areaAPI
API for Areas

## Routing
https://[host]/api/[area]/[year]/find?latitude=[lat]&longitude=[lon]&showall=[true/false]&format=[json/jsonp/xml]

## Examples
- CMA: https://areapi.herokuapp.com/api/cma/1990/find?latitude=38.9907&longitude=-77.0261&format=json
- BTA: https://areapi.herokuapp.com/api/bta/1990/find?latitude=39.7294&longitude=-104.8319&format=xml

## Parameters

| Parameter | Type | Description | Valid | Default | Required | 
| --- | --- | --- | --- | --- | --- |
| area | string | Type of area. | cma, bta | N/A | required | 
| year | numeric | Date of data. | 1990, 2000, 2010 | N/A | required | 
| latitude | numeric | Latitude of a location. | -90 to 90 | N/A | required | 
| longitude | numeric | Longitude of a location. | -180 to 180 | N/A | required | 
| format | string | File format of output. | json, jsonp, xml | json | optional | 
| showall | boolean | Return multiple areas. | true, false | true | optional |
