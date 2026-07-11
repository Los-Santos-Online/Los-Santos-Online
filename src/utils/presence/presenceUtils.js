export class PresenceParamNameValueCSVClient {
    constructor() {
    }
  
    // Parse the input string into a JSON array
    parse(typeNameValueStr) {
      const rows = typeNameValueStr.split(',');
      const parsedData = [];
  
      for (let i = 0; i < rows.length; i += 3) {
        const name = rows[i];
        const value = rows[i + 1];
        parsedData.push({ name, value });
      }
  
      return parsedData;
    }
  
    // Serialize the data back into a CSV string
    serialize() {
      return this.data.map(item => `${item.name},${item.value}`).join(',');
    }
  
    // Look up value by name
    lookup(name) {
      const item = this.data.find(item => item.name === name);
      return item ? item.value : null;
    }
  }


export class PresenceAttributesClient {
    constructor(typeNameValueStr) {
      this.data = this.parse(typeNameValueStr);
    }
  
    // Parse the input string into a JSON array
    parse(typeNameValueStr) {
      if (!typeNameValueStr) {
        return [];
      }

      const rows = typeNameValueStr.split(',');
      const parsedData = [];
  
      for (let i = 0; i < rows.length; i += 3) {
        const type = rows[i];
        const name = rows[i + 1];
        const value = rows[i + 2];
        parsedData.push({ type, name, value });
      }
      return parsedData;
    }
  
    // Add or replace values
    setAttributes(typeNameValueStr) {
      const newData = this.parse(typeNameValueStr);
  
      newData.forEach(newItem => {
        const index = this.data.findIndex(item => item.name === newItem.name);
        if (index !== -1) {
          this.data[index] = newItem;
        } else {
          this.data.push(newItem);
        }
      });
    }
  
    // Serialize the data back into a CSV string
    serialize() {
      return this.data.map(item => `${item.type},${item.name},${item.value}`).join(',');
    }
  
    // Look up value by name
    lookup(name) {
      const item = this.data.find(item => item.name === name);
      return item ? item.value : null;
    }

    // Look up value by name
    getAttribute(name) {
        const item = this.data.find(item => item.name === name);
        return item ? item.value : null;
    }
  }

export function getUndefinedPresenceEntries(typeNameValueStr) {
    const client = new PresenceAttributesClient(typeNameValueStr);

    return client.data.filter((item) =>
        [item.type, item.name, item.value].some(
            (field) => typeof field === 'string' && field.trim().toLowerCase() === 'undefined'
        )
    );
}
  
  
