const express = require("express");
const path = require("path");
const app = express();
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

app.use(express.json());

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;

const initializationDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("SERVER IS RUNNING AT http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DbError:${e.message}`);
  }
};

initializationDbAndServer();

const convertDbObjectToResponseObject = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

const convertDistrictDbToResponse = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};

const convertDistrictTotalCasesDbToResponse = (dbObject) => {
  return {
    totalCases: dbObject.cases,
    totalCured: dbObject.cured,
    totalActive: dbObject.active,
    totalDeaths: dbObject.deaths,
  };
};

function authenticateToken(request, response, next) {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (authHeader === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "covid19", (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
}

// APL 1

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `select * from user where username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "covid19");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//APL 2 GET STATES
app.get("/states/", authenticateToken, async (request, response) => {
  const getStateQuery = `
    SELECT 
        *
    FROM
        state
    ORDER BY
        state_id;`;
  const stateArray = await db.all(getStateQuery);
  response.send(
    stateArray.map((eachState) => convertDbObjectToResponseObject(eachState))
  );
});

// APL 3 GET STATE

app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;

  const statesCovidQuery = `
    SELECT 
        *
    FROM
        state
    WHERE
        state_id = ${stateId};`;
  const stateTable = await db.get(statesCovidQuery);
  response.send(convertDbObjectToResponseObject(stateTable));
});

//APL 4 POST DISTRICT

app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const postDistrictQuery = `
    INSERT INTO 
        district (district_name,state_id,cases,cured,active,deaths)
    VALUES
        ('${districtName}',
        ${stateId},
        ${cases},
        ${cured},
        ${active},
        ${deaths})`;
  await db.run(postDistrictQuery);
  //const districtId = districtTable.last();
  response.send("District Successfully Added");
});

// APL 5 GET DISTRICT

app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `
    SELECT 
        *
    FROM
        district
    WHERE
        district_id = ${districtId}`;
    const districtTable = await db.get(getDistrictQuery);
    response.send(convertDistrictDbToResponse(districtTable));
  }
);

// APL 6 DELETE DISTRICT

app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `
    DELETE FROM DISTRICT WHERE district_id = ${districtId}`;
    await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

// APL 7  PUT DISTRICT

app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistrictQuery = `
    update 
        district 
    SET 
        district_name= '${districtName}',
        state_id =   ${stateId},
        cases=   ${cases},
        cured= ${cured},
        active=  ${active},
        deaths=${deaths};
    WHERE
        district_id = ${districtId}`;
    const districtTable = await db.get(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

// APL 8 GET TOTAL STATE DETAILS

app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStatesCovidQuery = `
    SELECT 
        sum(cases) AS cases,
        sum(cured) AS cured,
        sum(active) AS active,
        sum(deaths) AS deaths  
    FROM 
        DISTRICT
    WHERE
        state_id = ${stateId}`;
    const stateTable = await db.get(getStatesCovidQuery);
    response.send(convertDistrictTotalCasesDbToResponse(stateTable));
    //console.log(stateTable);
  }
);

app.get(
  "/districts/:districtId/details/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const stateDetails = `
    SELECT 
        state_name 
    FROM 
        state JOIN district
         ON state.state_id = district.state_id 
        WHere 
        district.district_id = ${districtId}`;
    const stateName = await db.get(stateDetails);
    response.send({ stateName: stateName.state_name });
    //console.log(stateTable);
  }
);

module.exports = app;
