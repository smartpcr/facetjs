mysql = require('mysql')

module.exports = ({host, user, password, dataset}) ->
  connection = mysql.createConnection({
    host: 'localhost'
    user: 'root'
    password: ''
    database: 'facet'
  })

  connection.connect()
  return (sqlQuery, callback) ->
    connection.query(sqlQuery, callback)
    return