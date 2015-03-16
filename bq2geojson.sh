#!/bin/bash

if [ -z "$1" ]; then
	echo "You must supply a year as the first argument."
	exit
fi

if ! echo "$1" | grep -q '^[0-9]\{4\}$'; then
	echo "The first argument doesn't appear to be a year."
	exit
fi

year=$1
bq_opts="-n 1000000 --format csv"

mkdir -p csv
mkdir -p geojson

# If no 2nd argument was passed then just assume they want all months
if [ -z "$2" ]; then
	months=$(seq -w 01 12)
else
	months=$2
fi

for month in $months; do
	table="${year}_${month}"
	query=$(sed -e "s/tablename/${table}/" ./bigquery)
	echo "Querying BigQuery for ${month}/${year}";
	bq query $bq_opts "${bigquery}" | tail -n +2 > ./csv/$table.csv
done


# Process the CSV files with csv2geojson and Turf.js 
node index.js
