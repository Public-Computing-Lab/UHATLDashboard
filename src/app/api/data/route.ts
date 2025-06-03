import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';

export async function GET() {
  const results: any[] = [];
  const csvPath = path.join(process.cwd(), 'data', 'data.csv');

  return new Promise((resolve, reject) => {
    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', (data) => {
        try {
          results.push({
            email: data["email"],
            submission_datetime: data["submission datetime"],
            device: data["device"],
            transport: data["transport"],
            complete_check: data["complete?"]?.trim().toLowerCase() === 'true',
            csv_check: data["has csv?"]?.trim().toLowerCase() === 'true',
            temp_check: data["has temp?"]?.trim().toLowerCase() === 'true',
            location_check: data["has location?"]?.trim().toLowerCase() === 'true',
            start_time: data["start time"],
            stop_time: data["stop time"],
            num_records: Number(data["numrecords"]),
          });
        } catch (err) {
          console.error("Skipping invalid row:", data);
        }
      })
      .on('end', () => {
        resolve(NextResponse.json(results));
      })
      .on('error', (err) => {
        reject(NextResponse.json({ error: 'Failed to parse CSV', details: err }));
      });
  });
}
