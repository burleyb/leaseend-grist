const {GristDocAPI} = require('grist-api');

// Put here the URL of your document.
const GRIST_URL = "http://localhost:8484/api";


module.exports.handler = async (event) => {

  const api = new GristDocAPI(GRIST_URL);
  // Add some rows to a table
  await api.addRecords('Food', [
    {Name: 'eggs', AmountToBuy: 12},
    {Name: 'beets', AmountToBuy: 1},
  ]);

  // Fetch all rows.
  const data = await api.fetchTable('Food');
  console.log(data);

  // Sync data by a key column.
  await api.syncTable('Food', [{Name: 'eggs', AmountToBuy: 0}], ['Name']);


  return {
    statusCode: 200,
    body: JSON.stringify(
      {
        message: 'Go Serverless v3.0! Your function executed successfully!',
        input: event,
      },
      null,
      2
    ),
  };
};
