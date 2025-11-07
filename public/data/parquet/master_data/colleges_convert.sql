
      INSTALL json;
      LOAD json;
      COPY (SELECT * FROM read_json('/Users/kashyapanand/Public/New/public/data/parquet/master_data/colleges_temp.json')) TO '/Users/kashyapanand/Public/New/public/data/parquet/master_data/colleges.parquet' (FORMAT PARQUET, COMPRESSION SNAPPY);
    