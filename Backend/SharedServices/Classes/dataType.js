import * as supported from '../FileSystem/supportedFiles.js';

// For handling different data types in AI Responses, Reading & Writing files.
export class DataType {
    constructor(fileExtension, mimeType, encoding, fileData, sizeBytes = 0){
        this.fileExtension = fileExtension;
        this.mimeType = mimeType;
        this.encoding = encoding;
        this.sizeBytes = sizeBytes;
        this.data = fileData;
    }

    async saveToDisc(relativeFolderPath, fileName){
        // find supported write function. 
        Object.entries(supported.default).forEach( async ([key, value]) => {
            if(key == this.fileExtension || value.mimeType == this.mimeType){
                if (value.writeFN == null){
                    return Err(`Error (DataType -> saveToDisc) - no write function for ${key} files.`)
                }
                let save = await value.writeFN({
                    relativeFolderPath, 
                    fileContent, 
                    fileNameIncExt: `${fileName}.${fileExtension}`
                });
                if(save.isErr()){
                    return Err(`Error (DataType -> saveToDisc) : ${save.value}`); 
                }
                return save; // has Result class
            }
        });
        return Err(`Error (DataType -> saveToDisc) - ${this.fileExtension} are not supported.`)
    }
}