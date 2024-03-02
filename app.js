const express = require('express')
const path = require('path')
const app = express()
app.use(express.json())
const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
let db = null

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server is running')
    })
  } catch (e) {
    console.log(`DB Error: ${e.message}`)
    response.status(500).send('Internal Server Error')
  }
}

initializeDBAndServer()

//AUTHENTICATION with Token
const authenticationToken = (request, response, next) => {
  const authHeader = request.headers['authorization']
  if (authHeader === undefined) {
    response.status(401).send('Invalid JWT Token')
  } else {
    const token = authHeader.split(' ')[1]
    const verifyJWT = jwt.verify(token, 'CASPER', async (error, payload) => {
      if (error) {
        response.status(401).send('Invalid JWT Token')
      } else {
        next()
      }
    })
  }
}

//API 1
app.post('/login/', async (request, response) => {
  try {
    const {username, password} = request.body
    const getUserDetailsQuery = `
      SELECT 
      *
      FROM 
      user
      WHERE 
      username = ?;
    `
    const userDeatils = await db.get(getUserDetailsQuery, [username])
    if (userDeatils === undefined) {
      response.status(400).send('Invalid user')
    } else {
      const isPasswordMatched = await bcrypt.compare(
        password,
        userDeatils.password,
      )
      if (isPasswordMatched === true) {
        const payload = {
          username: username,
        }
        const jwtToken = await jwt.sign(payload, 'CASPER')
        response.send({jwtToken})
      } else {
        response.status(400).send('Invalid password')
      }
    }
  } catch (e) {
    console.log(e.message)
    response.status(500).send('Internal Server Error')
  }
})

const convertDBObjToResponseObj = obj => {
  return {
    stateId: obj.state_id,
    stateName: obj.state_name,
    population: obj.population,
  }
}

app.get('/states/', authenticationToken, async (request, response) => {
  try {
    const getStatesQuery = `
      SELECT
      *
      FROM
      state
      ORDER BY 
      state_id;
    `
    const dbResponse = await db.all(getStatesQuery)
    response.send(dbResponse.map(each => convertDBObjToResponseObj(each)))
  } catch (e) {
    console.log(e.message)
    response.status(500).send('Internal Server Error')
  }
})

//API 3
app.get('/states/:stateId/', authenticationToken, async (request, response) => {
  try {
    const {stateId} = request.params
    const getStateQuery = `
      SELECT 
      * 
      FROM 
      state
      WHERE 
      state_id = ?;
    `
    const dbResponse = await db.get(getStateQuery, [stateId])
    response.send(convertDBObjToResponseObj(dbResponse))
  } catch (e) {
    console.log(e.message)
    response.status(500).send('Internal Server Error')
  }
})

//API 4
app.post('/districts/', authenticationToken, async (request, response) => {
  try {
    const {districtName, stateId, cases, cured, active, deaths} = request.body
    const createDistrictQuery = `
    INSERT INTO 
    district(district_name, state_id, cases, cured, active, deaths)
    VALUES(?,?,?,?,?,?);
    `
    await db.run(createDistrictQuery, [
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    ])
    response.send('District Successfully Added')
  } catch (e) {
    console.log(e.message)
    response.status(500).send('Internal Server Error')
  }
})

//API 5
app.get(
  '/districts/:districtId',
  authenticationToken,
  async (request, response) => {
    try {
      const {districtId} = request.params
      const getDistrictQuery = `
        SELECT 
        *
        FROM 
        district
        WHERE 
        district_id = ?;
      `
      const dbResponse = await db.get(getDistrictQuery, [districtId])
      response.send({
        districtId: dbResponse.district_id,
        districtName: dbResponse.district_name,
        stateId: dbResponse.state_id,
        cases: dbResponse.cases,
        cured: dbResponse.cured,
        active: dbResponse.active,
        deaths: dbResponse.deaths,
      })
    } catch (e) {
      console.log(e.message)
      response.status(500).send('Internal Server Error')
    }
  },
)

//API 6
app.delete(
  '/districts/:districtId/',
  authenticationToken,
  async (request, response) => {
    try {
      const {districtId} = request.params
      const deleteDistrictQuery = `
        DELETE FROM
        district 
        WHERE 
        district_id = ?;
      `
      await db.run(deleteDistrictQuery, [districtId])
      response.send('District Removed')
    } catch (e) {
      console.log(e.message)
      response.status(500).send('Internal Server Error')
    }
  },
)

//API 7
app.put(
  '/districts/:districtId/',
  authenticationToken,
  async (request, response) => {
    try {
      const {districtId} = request.params
      const {districtName, stateId, cases, cured, active, deaths} = request.body
      const updateDistrictQuery = `
        UPDATE 
        district
        SET 
        district_name = ?,
        state_id = ?,
        cases = ?,
        cured = ?,
        active = ?,
        deaths = ?
        WHERE 
        district_id = ?;
      `
      await db.run(updateDistrictQuery, [
        districtName,
        stateId,
        cases,
        cured,
        active,
        deaths,
        districtId,
      ])
      response.send('District Details Updated')
    } catch (e) {
      console.log(e.message)
      response.status(500).send('Internal Server Error')
    }
  },
)

//API 8
app.get(
  '/states/:stateId/stats/',
  authenticationToken,
  async (request, response) => {
    try {
      const {stateId} = request.params
      const getStateStatsQuery = `
        SELECT 
        SUM(cases) AS totalCases,
        SUM(cured) AS totalCured,
        SUM(active) AS totalActive,
        SUM(deaths) AS totalDeaths
        FROM 
        district
        WHERE 
        state_id = ?;
      `
      const dbResponse = await db.get(getStateStatsQuery, [stateId])
      response.send(dbResponse)
    } catch (e) {
      console.log(e.message)
      response.status(500).send('Internal Server Error')
    }
  },
)

module.exports = app
