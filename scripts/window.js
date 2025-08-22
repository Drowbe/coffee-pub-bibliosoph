import { BIBLIOSOPH } from './const.js'

// Helper function to safely get Blacksmith API
function getBlacksmith() {
    return game.modules.get('coffee-pub-blacksmith')?.api;
}

export class BiblioWindowChat extends FormApplication {

    // ************************************
    // ** FORM Set the form variables
    // ************************************
    constructor() {
        super()
        this.onFormSubmit
        this.isPublic
        this.formTitle
        this.optionList
        this.selectedDivs = [];
    }

    // ************************************
    // ** FORM Set the form options
    // ************************************
    static get defaultOptions() {
        const defaults = super.defaultOptions
        const overrides = {
            height: 'auto',
            width: 'auto',
            id: "coffee-pub-bibliosoph",
            //id: "coffee-pub-bibliosoph-message-dialogue",
            template: BIBLIOSOPH.WINDOW_CHAT_TEMPLATE,
            title: BIBLIOSOPH.MESSAGES_FORMTITLE,
            closeOnSubmit: false, 
        };
        const mergedOptions = foundry.utils.mergeObject(defaults, overrides)
        return mergedOptions
    }

    // ************************************
    // ** FORM Pass the data to the form
    // ************************************
    getData(options) {
        // Pass the data to the form
        return {
            isPublic: this.isPublic,
            optionList: this.optionList,
            title: this.formTitle,
        }
    }
    
    // ************************************
    // ** FORM Manage selecting Divs
    // ************************************
    activateListeners(html) {
        super.activateListeners(html);
        
        // ** SELECTING IMAGES **
        // Look for selected images
        html.find('#optionChatType > img').on('click', (event) => { 
            let chosenValue = event.currentTarget.getAttribute("value");

            // Highlight the chosen option
            html.find('#optionChatType > img').removeClass('bibliosoph-option-image-selected');
            event.currentTarget.classList.add('bibliosoph-option-image-selected');
    
            // Save the selection in a hidden form field
            html.find('#hiddenOptionChatType').val(chosenValue);
        });

        // ** SELECTING DIVS **
        // Private List Divs
        html.find('div[name="selectable-div"]').on('click', (event) => {

            let divValue = $(event.currentTarget).attr('value'); // get value attribute of the clicked div
            // Toggle the 'selected' class on the clicked div
            $(event.currentTarget).toggleClass('bibliosoph-option-div-selected');
            // Update this.selectedDivs array
            if (this.selectedDivs.includes(divValue)) {
                this.selectedDivs = this.selectedDivs.filter(value => value !== divValue); // deselect
            } else {
                this.selectedDivs.push(divValue); // select
            }

        });
    }

    // ************************************
    // ** FORM Get the form data
    // ************************************
    async _updateObject(event, formData) {
        //Set the Data retrieved from the form
        BIBLIOSOPH.MESSAGES_TITLE = formData.optionChatTypeHidden;
        // BIBLIOSOPH.MESSAGES_LIST_TO_PRIVATE= formData.checkPrivateTo;
        BIBLIOSOPH.MESSAGES_LIST_TO_PRIVATE = this.selectedDivs;
        BIBLIOSOPH.MESSAGES_CONTENT = formData.inputMessage;
        // NEED TO SET THE CARD TYP IN CASE THEY KEPT IT OPEN.
        if (formData.hiddenCardTypeCategory == "CARDTYPEWHISPER") {
            BIBLIOSOPH.CARDTYPE = "Message";
            BIBLIOSOPH.CARDTYPEWHISPER = true;
        } else {
            BIBLIOSOPH.CARDTYPE = "Message";
            BIBLIOSOPH.CARDTYPEMESSAGE = true;
        }

        // this is called when the form is submitted
        if (this.onFormSubmit) {

            this.onFormSubmit()
        }
        // Clear input field after form submission
        // check to see if they sent it to anyone before clearing
        if (BIBLIOSOPH.CARDTYPEWHISPER) {
            // Only clear if they chose recipients
            if (BIBLIOSOPH.MESSAGES_LIST_TO_PRIVATE.length === 0) {
                // do not clear the form
            } else {
                $(event.currentTarget).find('textarea#inputMessage').val('');
            }
        } else {
            // Clear the form
            $(event.currentTarget).find('textarea#inputMessage').val('');
        }        
    }
}
