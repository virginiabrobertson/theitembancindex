// Item Banc Search Function - VERSION 2 - 2026-06-11
// Server-side Airtable proxy - token comes from Netlify environment variable

const AT_TOKEN = process.env.AIRTABLE_TOKEN;
const AT_BASE = 'appkark1AtBqJafiG';
const AT_TABLE = 'tblKJu4pUNqrvVJvc';
const AT_URL = `https://api.airtable.com/v0/${AT_BASE}/${AT_TABLE}`;

const CAT_KEYWORDS = {
  'Paper': ['toilet paper','paper towel','copy paper','paper plate','paper cup','napkin','kleenex','tissue'],
  'Food': ['tuna','chicken','beans','sardine','peanut butter','pasta','rice','salt','coffee','tea','tomato','lentil','water','cooking oil','milk','juice'],
  'Clothing': ['sandal','shoe','sock','underwear','jean','shorts','t-shirt','tshirt','sweatshirt','baby clothes','towel','blanket','pillow'],
  'Medical': ['shampoo','soap','first aid','laundry detergent','hygiene','diaper','wipe','feminine','mask','sanitizer'],
  'Building': ['plywood','lumber','2x4','tarp','metal sheet','cement','hammer','nail','screwdriver','flashlight','rebar','duct tape','broom']
};

exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (!AT_TOKEN) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Server misconfigured: AIRTABLE_TOKEN not set' })
    };
  }

  try {
    const params = event.queryStringParameters || {};
    const itemRaw = params.item || '';
    const loc = params.loc || '';
    const cat = params.cat || '';
    const termsRaw = params.terms || '';

    const parts = ['NOT({Status}="Draft")'];

    if (itemRaw || termsRaw) {
      const termList = termsRaw
        ? termsRaw.split(',').map(t => t.trim()).filter(Boolean)
        : [itemRaw];

      const termParts = termList.map(t =>
        `FIND(LOWER("${t.replace(/"/g, '')}")` + `,LOWER({Item Name}))>0`
      );
      parts.push(termParts.length > 1
        ? 'OR(' + termParts.join(',') + ')'
        : termParts[0]
      );
    } else if (cat && CAT_KEYWORDS[cat]) {
      const kws = CAT_KEYWORDS[cat];
      const orParts = kws.map(k =>
        `FIND(LOWER("${k}"),LOWER({Item Name}))>0`
      );
      parts.push('OR(' + orParts.join(',') + ')');
    }

    if (loc) {
      parts.push(`FIND(LOWER("${loc.replace(/"/g, '')}"),LOWER({Item Location}))>0`);
    }

    const formula = 'AND(' + parts.join(',') + ')';
    const url = AT_URL
      + '?filterByFormula=' + encodeURIComponent(formula)
      + '&sort[0][field]=Item+Name&sort[0][direction]=asc';

    const response = await fetch(url, {
      headers: { 'Authorization': 'Bearer ' + AT_TOKEN }
    });

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ error: 'Airtable error: ' + response.status })
      };
    }

    const data = await response.json();

    const records = (data.records || []).map(rec => ({
      id: rec.id,
      fields: {
        'Item Name': rec.fields['Item Name'] || '',
        'Item Location': rec.fields['Item Location'] || '',
        'Item Price': rec.fields['Item Price'] || '',
        'Item Currency': rec.fields['Item Currency'] || 'USD',
        'Business Name': rec.fields['Business Name'] || '',
        'Website': rec.fields['Website'] || '',
        'Status': rec.fields['Status'] || ''
      }
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ records })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
