let xlsx = require('node-xlsx');

export function loadXlsx(filePath: string) {
    let workbook = xlsx.parse(filePath);
    const sheet = workbook[0].data;

    let _titles = [];
    let _keys = [];

    const row_title = sheet[1];
    const row_keys = sheet[2];

    let col_id = 0;

    let dict_key_title: any = {};

    for (let i = 0; i < row_keys.length; ++i) {
        if (row_keys[i]) {
            _titles.push(row_title[i]);
            _keys.push(row_keys[i]);

            if(row_keys[i] === '_id') {
                col_id = i;
            }

            dict_key_title[row_keys[i]] = row_title[i];
        }
    }

    let dict: any = {};
    

    for (let i = 4; i < sheet.length; ++i) {
        let row = sheet[i];
        if (!row[col_id]) {
            break;
        }
        dict[row[col_id]] = {};
        for (let j = 0; j < row.length; ++j) {
            if (row_keys[j]) {
                dict[row[col_id]][row_keys[j]] = row[j];
            }
        }
    }

    return {
        'value': dict,
        'key_title': dict_key_title,
    };
}

// let dict = loadXlsx('../equipment.xlsx');
// console.log(dict);






