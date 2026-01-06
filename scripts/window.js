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
            width: 600,
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
    
    /**
     * Get native DOM element from this.element (handles jQuery conversion)
     * @returns {HTMLElement|null} Native DOM element
     */
    _getNativeElement() {
        if (!this.element) return null;
        // v13: Detect and convert jQuery to native DOM if needed
        if (this.element.jquery || typeof this.element.find === 'function') {
            return this.element[0] || this.element.get?.(0) || this.element;
        }
        return this.element;
    }
    
    // ************************************
    // ** FORM Manage selecting Divs
    // ************************************
    activateListeners(html) {
        super.activateListeners(html);
        
        // v13: Detect and convert jQuery to native DOM if needed
        let nativeHtml = html;
        if (html && (html.jquery || typeof html.find === 'function')) {
            nativeHtml = html[0] || html.get?.(0) || html;
        }
        
        // ** SELECTING IMAGES **
        // Look for selected images
        const images = nativeHtml.querySelectorAll('#optionChatType > img');
        images.forEach(img => {
            img.addEventListener('click', (event) => {
                let chosenValue = event.currentTarget.getAttribute("value");

                // Highlight the chosen option
                images.forEach(i => i.classList.remove('bibliosoph-option-image-selected'));
                event.currentTarget.classList.add('bibliosoph-option-image-selected');
        
                // Save the selection in a hidden form field
                const hiddenInput = nativeHtml.querySelector('#hiddenOptionChatType');
                if (hiddenInput) hiddenInput.value = chosenValue;
            });
        });

        // ** SELECTING DIVS/IMAGES **
        // Private List Divs (full layout) and Images (compressed layout)
        const selectableDivs = nativeHtml.querySelectorAll('div[name="selectable-div"], img[name="selectable-div"]');
        selectableDivs.forEach(element => {
            // Pre-select elements if they're in the selectedDivs array (for reply functionality)
            let elementValue = element.getAttribute('value');
            if (this.selectedDivs && Array.isArray(this.selectedDivs) && this.selectedDivs.includes(elementValue)) {
                if (element.tagName === 'IMG') {
                    element.classList.add('bibliosoph-option-image-selected');
                } else {
                    element.classList.add('bibliosoph-option-div-selected');
                }
            }
            
            element.addEventListener('click', (event) => {
                let elementValue = event.currentTarget.getAttribute('value'); // get value attribute of the clicked element
                // Toggle the 'selected' class - handle both div and image layouts
                if (event.currentTarget.tagName === 'IMG') {
                    // Compressed layout: use image selected class
                    event.currentTarget.classList.toggle('bibliosoph-option-image-selected');
                } else {
                    // Full layout: use div selected class
                    event.currentTarget.classList.toggle('bibliosoph-option-div-selected');
                }
                // Update this.selectedDivs array
                if (this.selectedDivs.includes(elementValue)) {
                    this.selectedDivs = this.selectedDivs.filter(value => value !== elementValue); // deselect
                } else {
                    this.selectedDivs.push(elementValue); // select
                }
            });
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
        // v13: Detect and convert jQuery to native DOM if needed
        let nativeForm = event.currentTarget;
        if (event.currentTarget && (event.currentTarget.jquery || typeof event.currentTarget.find === 'function')) {
            nativeForm = event.currentTarget[0] || event.currentTarget.get?.(0) || event.currentTarget;
        }
        
        if (BIBLIOSOPH.CARDTYPEWHISPER) {
            // Only clear if they chose recipients
            if (BIBLIOSOPH.MESSAGES_LIST_TO_PRIVATE.length === 0) {
                // do not clear the form
            } else {
                const textarea = nativeForm.querySelector('textarea#inputMessage');
                if (textarea) textarea.value = '';
            }
        } else {
            // Clear the form
            const textarea = nativeForm.querySelector('textarea#inputMessage');
            if (textarea) textarea.value = '';
        }        
    }
}
