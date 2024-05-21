// -------------------------------------------------------------------------------------------------
// External dependencies
// -------------------------------------------------------------------------------------------------
import { inspect } from 'util'

/**
 * Custom JSON jsonToString function (aka beautify)
 * @param {JSON} jsonObject: a JSON object
 * @param {String or number} options: jsonToStr options. 4 or '\t' make it possible
 *                                    to display the JSON on several lines
 * @returns {String} jsonToStr options
 */
export const jsonToStr = (jsonObject, option) => {
  try {
    return `${JSON.stringify(jsonObject, null, option).replace(/\\"/g, '"')}${option != null ? '\n' : ''}`
  } catch (err) {
    return `${inspect(jsonObject)}`
  }
}

export const cleanHeadersAuth = (str) =>
  typeof str == 'string' ? str.replace(/["'](Bearer|Basic) [\w-/\.]+["']/g, '<auth>') : cleanHeadersAuth(jsonToStr(str))

export const safeStringify = (str) => (str ? cleanHeadersAuth(str) : '')
