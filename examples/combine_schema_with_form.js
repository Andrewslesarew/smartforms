var combiner = {
  getForm: function(schemaJson, formJson, globalConfig){

    var schema = JSON.parse(JSON.stringify(schemaJson));
    var form = JSON.parse(JSON.stringify(formJson));//Optimize
    const allowedIndividualElements = [
            'штрихкод',
            'лицевой-счет'
        ];
    const allowedCombinationElements = [
            [
                'лицевой-счет',
                'год',
                'месяц'
            ],
            [
                'лицевой-счет',
                'район',
                'месяц',
                'год'
            ]
        ];

    return splitItems();

    function splitItems() {

        if ((schema.length === 1) && isAllowedIndividualElements(schema[0].name)) {// Optimize
            leaveOnlyOneElement(schema[0].name);
            addAdditionalAttributes(form); //Dublicate
            return form;
        };

        if (isAllowedCombination(schema)) {
            leaveOnlyAllowedElement(schema);
        };

        schema.filter(isTable).forEach(function(item) {
            calculateTableElement(item)
        });

        schema.filter(e => !isTable(e)).forEach(function(item) {
            calculateSimpleElement(item)
        });

        schema.filter(e => isSummarized(e)).forEach(function(item) {
            addElementsToSummarizeContainer(item)
        });

        addAdditionalAttributes(form);

      console.log('Полученая схема');
      console.log(schema);
      console.log('Сгенерированная форма');
      console.log(form);
      return form;
    };

    function isAllowedIndividualElements (allovedElementName) {
        return allowedIndividualElements.indexOf(allovedElementName) > -1 //markTags.includes(elementName)
    };

    function isAllowedCombination (schemaElements) { //refactor
        var elements = [];
        schemaElements.forEach(function(item) {
            elements.push(item.name);
        });

        var identical = false;
        allowedCombinationElements.forEach(function(item) {
            if (arraysIdentical(item, elements)) {
                identical = true;
            }
        });

        return identical;
    };

    function arraysIdentical(a, b) {
        var i = a.length;
        var k = i;
        var flag = false;
        if (i != b.length) return false;
        while (i--) {
            flag = false;
            k = a.length;
            while (k--) {
                if (a[i] == b[k]) {
                    flag = true;
                    break;
                }
            }
            if (!flag) return false;
        }
        return true;
    };

    function leaveOnlyOneElement (fieldName) {
        form.body.schema = [fieldName];
        form.body.form[fieldName] = globalConfig[fieldName];
    };

    function leaveOnlyAllowedElement (schema) { //refactor
        var namesFromSchema = [];
        var newSchema = [];
        schema.forEach(function(item) {
            namesFromSchema.push(item.name);
        });
        form.body.form = [];
        form.body.schema.forEach(function(item) {
            if (namesFromSchema.indexOf(item) !== -1)
                newSchema.push(item);
            if (item == 'период-оплаты' && (namesFromSchema.indexOf('месяц') !== -1) && (namesFromSchema.indexOf('год') !== -1))
                newSchema.push(item);
        });

        form.body.schema = newSchema;
    };

    function isTable(obj) {
        return 'columns' in obj;
    };

    function isSummarized(obj) {
        return 'summarize' in obj;
    };

    function calculateTableElement(element) {
        var itemDescription = tableIsInForm(element);
        if (itemDescription.type === 'table') 
            createTable(element);
        if (itemDescription.type === 'fieldset') 
            createFieldset(element);
        if (itemDescription.type === 'text')
            createCustomTextTable(element);
        if (itemDescription.type === 'array')
            createCustomArrayTable(element);
        if (itemDescription.type === 'select')
            createCustomSelectTable(element);
        if (itemDescription.type === 'input')
            createCustomInputTable(element);
        if (itemDescription.type === 'emptyTable')
            deleteItemFromSchema(element);
    };

    function calculateSimpleElement(element) {
        var elementName = element.name;
        var formElement = null;
        if (elementIsInForm(elementName)) {
            formElement = form.body.form[elementName];
            formElement.value = element.value;
            formElement.validationRules = [];
            if (element.visible === false) //refactor
                formElement.hidden = true;
            else if (element.constraints) {
                element.constraints.forEach(function(item) {
                    formElement.validationRules.push({rule: item.constraint, errorMessage: item.error});
                });
            }
        }
    };

    function addElementsToSummarizeContainer(element) {
        if(form.body.form[element.summarize])
            form.body.form[element.summarize].summarize.push(element.name);
    };

    function tableIsInForm(element) {
        var description = {
            thereIsInForm: false,
            type: "emptyTable"
        };
        if (element.values && element.values.length < 1) //Optimize
            return description;
        const elementName = element.name;
        if (tableThereIsNotInConfig(elementName))
            return description;
        form.body.schema.forEach(function(item) { //Change on filter
            if(item === elementName || item.name === elementName) {
                description.thereIsInForm = true;
                description.type = item.block || form.body.form[elementName].block;
            }
        });
        return description;
    };

    function addAdditionalAttributes(form) {
        if (globalConfig.submitButton)
            form.submitButton = globalConfig.submitButton;
        if (globalConfig.iagree)
            form.iagree = globalConfig.iagree;
    };

    function tableThereIsNotInConfig(elementName) {
        if (form.body.form && form.body.form[elementName]) //Optimize
            return false;

        var objectOfElementInSchema = form.body.schema.filter(function(item) { 
            return item.name === elementName;  
        });
        if (objectOfElementInSchema.length !== 0)
            return false;

        if (elementName in globalConfig) {
            createFormAttribute();
            form.body.form[elementName] = globalConfig[elementName];
            return false;
        }
        return true;
    };

    function createFormAttribute() {
        if (form.body.form === undefined)
            form.body.form = {};
    };

    function elementIsInForm(name) {
        return (name in form.body.form) || elementIsInConfig(name);
    };

    function elementIsInConfig(name) {
        if (name in globalConfig) {
            form.body.form[name] = globalConfig[name];
            return true;
        }
        return false;
    };

    function createTable(element) {
        var columns = calculateColumns(element);
        createColumnHeaders(element.name, columns);
        calculateTableColumns(element, columns);
    };

    function createFieldset(element) {
        var columns = calculateColumns(element);
        createRowsForFieldset(element.name, element.values.length);//was element.columns.length
        calculateTableColumns(element, columns);
    };

    function createCustomTextTable(schemaElement) {
        var element = form.body.form[schemaElement.name];
        element.value = schemaElement.values[0]['к-оплате'];
    };

    function createCustomArrayTable(element) {
        var elementName = element.name;
        var headers = element.columns;
        var arrayFormElement = form.body.form[elementName];
        arrayFormElement.items = [];
        calculateColumnHeaders(headers, elementName, arrayFormElement);
        element.values.forEach(function(item, index) {
            calculateArrayItems(item, arrayFormElement, elementName, index, headers);
        });
    };

    function createCustomSelectTable(element) {
        var elementName = element.name;
        var selectElement = form.body.form[elementName];
        element.values.forEach(function(item) {
            if (item.значение !== undefined) {
                selectElement.values.push({name: item.значение, value: item.значение});
            } else {
                selectElement.values.push({name: item.name, value: item.value});
            }
        });
        var activeElement = element.values.filter(function(item) {
            return item.isActive === true;
        });
        selectElement.value = activeElement[0].значение ? activeElement[0].значение : activeElement[0].value;
    };

    function calculateColumnHeaders(headers, elementName, formElement) {
        if (formElement.columnHeaders)
            headers.forEach(function(item) {
                formElement.columnHeaders.push(normalizeHeader(item.name));
            });
    }

    function calculateArrayItems(item, formElement, elementName, index, headers) { //refactor
        var itemName = elementName + '_' + headers[1].name + '_' + index;
        var nameService = item[headers[0].name];
        var itemTemplate = null;

        if (index < 3) {
            itemTemplate = {
                label: nameService,
                value: item[headers[1].name] || '0.00',
                name: itemName
            };
            formElement.items.push(itemTemplate);
        }
        else {
            itemTemplate = {
                value: itemName,
                name: nameService
            };
            formElement.actions.select.values.push(itemTemplate); 
        }
    };

    function createCustomInputTable(element) {
        var elementName = element.name;
        var formElement = form.body.form[elementName];
        formElement.value = element.values.filter(function(item) { 
            return item.isActive == true;  
        })[0].значение;
        console.log(element);
    };

    function deleteItemFromSchema(element) {
        form.body.schema = form.body.schema.filter(function(item) { 
            return item.name !== element.name;  
        });
    };

    function calculateColumns(element) {
        var columns = [];
        element.columns.filter(columnIsVisible).forEach(function(column) {
            columns.push(column.name);
        });
        return columns;
    };

    function columnIsVisible(obj) {
        if (obj.visible === false)
            return false;
        return true;
    };

    function calculateTableColumns(element, columns) {
        element.values.forEach(function(item, i) { 
            columns.forEach(function(key) { 
                createTableColumnElement(key, item[key], element.name, i);
            });
        });
    }

    function createTableColumnElement(key, value, tableName, elementNumber) {
        var elementName = tableName + '_' + key + '_' + elementNumber
        
        var summElement = form.body.form['всего-к-оплате']; //refactor
        if (key === 'к-оплате' && summElement)
            summElement.summarize.push(elementName);

        var formElement = Object.assign({},form.body.form[key]);
        (formElement.block === 'label') ?
            formElement.labelText = value :
            formElement.value = value
        
        form.body.form[elementName] = formElement;

        insertElementNameInToTableItems(elementName, tableName);
    };

    function insertElementNameInToTableItems(elementName, tableName) {
        var index = form.body.schema.findIndex(x => x.name === tableName);
        form.body.schema[index].items.push(elementName);
    };

    function createColumnHeaders(tableName, headers) {
        var index = form.body.schema.findIndex(x => x.name === tableName);
        var columnHeaders = form.body.schema[index].columnHeaders;

        headers.forEach(function(key) { 
            if(columnHeaders)
                columnHeaders.push(normalizeHeader(key));
        });
    };

    function normalizeHeader(header) {
        var result = header.replace(/-/g,' ');
        result = result.charAt(0).toUpperCase() + result.substr(1).toLowerCase();
        return result;
    };

    function createRowsForFieldset(fieldsetName, count) {
        var element = form.body.schema.find(x => x.name === fieldsetName)
        var layout = element.layout[0];
        for ( ; count > 0 ; count--) {
            element.layout.push(layout);
        }
    };
  },

  getSchema: function(schemaJson, formData){

    var schema = JSON.parse(JSON.stringify(schemaJson));
    var form = formData;

    const markTags = [
            'метка',
            'добавить-метку'
        ];
    const reminderTags = [
            'добавить-напоминание',
            'тип-напоминания',
            'напоминание'
        ];

    return mergeSchemaAndFormData();

    function mergeSchemaAndFormData() {
        schema.filter(isTable).forEach(function(object) {
            mergeTableElement(object)
        });

        schema.filter(e => !isTable(e)).forEach(function(object) {
            mergeSimpleElement(object)
        });

        console.log('Заполеннная форма');
        console.log(formData);
        console.log('Заполеннная схема');
        console.log(schema);
        return schema;
    };

    function isTable(obj) {
        return 'columns' in obj;
    }

    function mergeSimpleElement(element) {
        const elementName = element.name;
        if (markTags.includes(elementName))
            calculateMark(element);
        else if (reminderTags.includes(elementName))
            calculateReminder(element);
        else {
            var value = form[elementName];
            if (value)
                element.value = value;
        }
    };

    function calculateMark(element) {
        const elementName = element.name;
        var value = null;

        switch (elementName) {
            case 'метка':
                value = form['метка']['метка'];
                break;
            case 'добавить-метку':
                value = form['метка']['добавить-метку'];
                break;
        }

        if (value != null)
            element.value = value;
    };

    function calculateReminder(element) { //Refactor
        const elementName = element.name;
        var value = null;
        const addReminder = form['Напоминание']['добавить-напоминание']; 


        if (elementName === 'добавить-напоминание')
            value = addReminder; 

        if (elementName === 'напоминание' && addReminder) {
            var date = form['Напоминание']['напоминание']['дата'];
            value = date ? date : form['Напоминание']['напоминание']['число']; 
        }
        if (elementName === 'тип-напоминания' && addReminder)
            value = form['Напоминание']['напоминание']['напоминание']; 
            
        if (value != null)
            element.value = value;

    };

    function mergeTableElement(element) {
        var items = form[element.name];
        var isActiveAtributeInElement = element.columns.filter(isSelect);

        if (items === undefined)
            return false;

        if (typeof items === 'string') { // Optimize
            if (isActiveAtributeInElement.length === 0)
                mergeCustomTextTable(element);
            else
                calculateSelectElement(element, items);
            return false;
        };

        if (element.name in items) { // Optimize
            mergeCustomRadioGroup(element);
            return false;
        }

        mergeTable(element);
    };

    function isSelect(obj) {
        return obj.name === 'isActive';
    };

    function mergeTable(element) {
        var items = form[element.name];
        var splittedClumn = null;
        for(var key in items) { 
            splittedClumn = key.split('_'); 
            element.values[splittedClumn[2]][splittedClumn[1]] = items[key];
        }
    };

    function mergeCustomTextTable(element) {
        element.values[0]['к-оплате'] = form[element.name];
    };

    function calculateSelectElement(element, selectedElement) {
        element.values.forEach(function(item) {
            item.isActive = (selectedElement === item.значение) ? true : false;
        });
    }

    function mergeCustomRadioGroup(element) {
        var elementName = element.name;
        element.values = [];
        element.values.push({'наименование-услуги': form[elementName][elementName], 'к-оплате': form[elementName]['к-оплате']});
    };
  },

  getCart: function(schemaJson, globalConfig) {

    var schemas = schemaJson;
    var cartForm = {
            block: "modal",
            submitButton: {
                label: "Перейти к оплате"
            },
            iagree: {
                htmlLabel: "Я соглашаюсь с <a href=\"/legal-information/docs/\" target=\"_blank\">условиями<\/a> договора-оферты",
                checked: true
            },
            isPanelGroup: true,
            body: {
                form: { },
                schema: [ ]
            }
        };
    var form = JSON.parse(JSON.stringify(cartForm));//Optimize


    return splitItems();

    function splitItems() {
        schemas.forEach(function(item, index) { 
            calculateItemOfCart(item, index);
        });

        console.log('Полученая схема');
        console.log(schemas);
        console.log('Сгенерированная форма');
        console.log(form);
        return form;
    };

    function calculateItemOfCart(item, index) {
        var element      = JSON.parse(JSON.stringify(globalConfig['платеж-корзины']));//Optimize
        element.title    = item.form.title;
        element.subtitle = item.form.subtitle;
        element.cost     = item.schema.find(x => x.name === 'всего-к-оплате').value;
        element.imgUrl   = item.form.imgUrl;
        addFieldsFromGlobalConfig(item.form, globalConfig);
        const calculatedForm = combiner.getForm(item.schema, item.form, globalConfig).body;
        element.form = JSON.parse(JSON.stringify(calculatedForm)); //Optimize
        var elementName  = item.schema.find(x => x.name === 'guid').value
        pushItemNameInToCartSchema(elementName);
        form.body.form[elementName] = element;
    };

    function addFieldsFromGlobalConfig(formOfInvoice, config) {//Refactor!!!!
        var resultForm = formOfInvoice.body;
        resultForm.schema.forEach(function(item, index) {  //Optimize
            if ((typeof item === 'string') && !(item in resultForm.form) && (item in config)) {
                if (config[item].block === 'fieldset')
                   resultForm.schema[index] = JSON.parse(JSON.stringify(config[item]));//Optimize
                else
                   resultForm.form[item] = JSON.parse(JSON.stringify(config[item]));
            }
        });
    };

    function pushItemNameInToCartSchema(elementName) {
        form.body.schema.push(elementName);
    };
  },

  getReceiptForm: function(reports, linkToReports) {

    var reportsForm = {
        items: [
            {
                name: "receiptModalBody",
                block: "receiptModalBody",
                reports: reports
            },
            {
                name: "receiptButton",
                block: "receiptModalFooter",
                text: "Распечатать все",
                link: linkToReports
            }
        ]
    };
    var form = JSON.parse(JSON.stringify(reportsForm));//Optimize


    return splitItems();

    function splitItems() {
        return form;
    }
  },

  getPersonalDataForm: function(schemaJson, formJson){

    const addressFields = [
            'адрес-одной-строкой',
            'дом',
            'корпус',
            'квартира'
        ];

    return splitItems();

    function splitItems() {
        schemaJson.forEach(function(item) {
            calculateSimpleElement(item)
        });
        return formJson;
    }

    function calculateSimpleElement(element) {
        var elementName = element.name;
        var formElement = null;

        if (addressFields.includes(elementName))
            formElement = formJson.form.address.items[elementName];
        else
            formElement = formJson.form[elementName];

        if (formElement) 
            formElement.value = element.value;
    };
  },

  getPersonalDataSchema: function(schemaJson, formData){

    var schema = schemaJson;
    var form = formData;

    return mergeSchemaAndFormData();

    function mergeSchemaAndFormData() {
        schema.forEach(function(object) {
            mergeElements(object);
        });
        
        return schema;
    };

    function mergeElements(element) {
        var elementName = element.name;
        if (elementName in form)
            element.value = form[elementName];
    };
  }
}

//2000001336601
//380000069799 - РЦ Томск
