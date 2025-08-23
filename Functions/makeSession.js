const axios = require("axios");

async function create(data) {
  try {
    const config = {
      method: 'post',
      url: 'https://pastebin.com/api/api_post.php',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      data: new URLSearchParams({
        'api_dev_key': 'ypkqXUGgzysc_yLPTBaEZ_G3G-nvjEsh',
        'api_option': 'paste',
        'api_paste_code': data,
        'api_paste_private': '1', 
        'api_paste_expire_date': 'N' 
      })
    };
    
    const res = await axios(config);
        const pu = res.data;
    const pasteId = pu.split('/').pop();
    
    return { id: pasteId };
  } catch (error) {
    throw new Error(`${error.message}`);
  }
}

async function get(key) {
  try {
    const config = {
      method: 'get',
      url: `https://pastebin.com/raw/${key}`
    };
    
    const res = await axios(config);
    return res.data;
  } catch (error) {
    throw new Error(`${error.message}`);
  }
}

module.exports = { create, get };
