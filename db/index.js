const { Client } = require('pg');

const CONNECTION_STRING = process.env.DATABASE_URL || 'postgres://localhost:5432/phenomena-dev'

const client = new Client(CONNECTION_STRING)

async function getOpenReports() {
  try {
    const {rows: reports } = await client.query(`
      SELECT *
      FROM reports
      WHERE "isOpen" = true;
    `)

    const { rows: comments } = await client.query(`
      SELECT *
      FROM comments
      WHERE "reportId"
      IN( ${reports.map( report => report.id).join(',')})
    `)

    reports.forEach( report => {
      report.comments = comments.filter(comment => comment.reportId === report.id )
      report.isExpired = Date.parse(report.expirationDate) < new Date()
      delete report.password
    })

    return reports;

  } catch (error) {
    throw error;
  }
}

async function createReport(reportFields) {

  const {title, location, description, password} = reportFields;


  try {

    const { rows: [report] } = await client.query(`
      INSERT INTO reports(title, location, description, password)
      VALUES($1, $2, $3, $4)
      RETURNING *;
    `, [title, location, description, password])

    delete report.password;

    return report;

  } catch (error) {
    throw error;
  }
}

async function _getReport(reportId) {
  try {

    const {rows: [report]} = await client.query(`
    SELECT *
    FROM reports
    WHERE id=${reportId};
  `);
    
    return report;

  } catch (error) {
    throw error;
  }
}


async function closeReport(reportId, password) {
  try {
    const closeReport = await _getReport(reportId);

    if(!closeReport) {
      throw Error('Report does not exist with that id') ;
    } else if(closeReport.password !== password) {
      throw Error("Password incorrect for this report, please try again");
    } else if(closeReport.isOpen === false ) {
      throw Error('This report has already been closed');
    } else {
       await client.query(`
        UPDATE reports
        SET "isOpen" = false
        WHERE id=${reportId}
       `)
    }

    return {message: "Report successfully closed!"}

  } catch (error) {
    throw error;
  }
}


async function createReportComment(reportId, commentFields) {

  const { content } = commentFields;

  try {
   
    const report = await _getReport(reportId);
  
    if(!report) {
      throw Error("That report does not exist, no comment has been made");
    }

    if(report.isOpen === false ) {
      throw Error('That report has been closed, no comment has been made');
    }

    if(Date.parse(report.expirationDate) < new Date()) {
        throw Error('The discussion time on this report has expired, no comment has been made');
    };

    const { rows: [comment]} = await client.query(`
    INSERT INTO comments("reportId", content)
    VALUES($1, $2)
    RETURNING *;
    `, [reportId, content])

 
    await client.query(`
      UPDATE reports
      SET "expirationDate" = CURRENT_TIMESTAMP + interval '1 day'
      WHERE id = ${reportId}
      RETURNING *
    `);

    return comment;

  } catch (error) {
    throw error;
  }
}

module.exports = {
  client,
  getOpenReports,
  createReport,
  _getReport,
  closeReport,
  createReportComment
}