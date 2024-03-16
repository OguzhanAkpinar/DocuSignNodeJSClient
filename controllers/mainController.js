const path = require('path');

const result = async (req, res) => {
    res.sendFile(path.join(__dirname+'/../views/result.html'));
}
  
module.exports = {
    result
};