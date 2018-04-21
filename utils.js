/**
 * Randomly select an element of items, at random.
 * @param  {Array} items The collection of items to choose from
 * @return {Object}      The randomly selected entry
 */
exports.choose = (items) => items[Math.floor(Math.random()*items.length)]
