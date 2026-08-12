const React = require('react');

const DummyChart = (props) => React.createElement('div', { className: props.className }, 'Chart');

module.exports = new Proxy({}, {
  get: function(target, prop) {
    if (prop === '__esModule') return true;
    return DummyChart;
  }
});
