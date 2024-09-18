import React, { Fragment } from 'react';
import PropTypes from 'prop-types';

import Log from '../../logger';

import $ from 'jquery';
import Easymde from 'easymde';

import 'inlineAttachment';
import 'inputInlineAttachment';
import 'cm4InlineAttachment';

class EasyMDE extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      value: '',
      loaded: false
    };

    this.uploadImage = this.uploadImage.bind(this);

    this.toolbarItems = [
      {
        name: 'bold',
        action: Easymde.toggleBold,
        className: 'material-icons mi-bold no-ajaxy',
        title: 'Bold'
      },
      {
        name: 'italic',
        action: Easymde.toggleItalic,
        className: 'material-icons mi-italic no-ajaxy',
        title: 'Italic'
      },
      {
        name: 'Title',
        action: Easymde.toggleHeadingSmaller,
        className: 'material-icons mi-title no-ajaxy',
        title: 'Title'
      },
      '|',
      {
        name: 'Code',
        action: Easymde.toggleCodeBlock,
        className: 'material-icons mi-code no-ajaxy',
        title: 'Code'
      },
      {
        name: 'Quote',
        action: Easymde.toggleBlockquote,
        className: 'material-icons mi-quote no-ajaxy',
        title: 'Quote'
      },
      {
        name: 'Generic List',
        action: Easymde.toggleUnorderedList,
        className: 'material-icons mi-list no-ajaxy',
        title: 'Generic List'
      },
      {
        name: 'Numbered List',
        action: Easymde.toggleOrderedList,
        className: 'material-icons mi-numlist no-ajaxy',
        title: 'Numbered List'
      },
      '|',
      {
        name: 'Create Link',
        action: Easymde.drawLink,
        className: 'material-icons mi-link no-ajaxy',
        title: 'Create Link'
      },
      '|',
      {
        name: 'Toggle Preview',
        action: Easymde.togglePreview,
        className: 'material-icons mi-preview no-disable no-mobile no-ajaxy',
        title: 'Toggle Preview'
      },
      '|',
      {
        name: 'upload-image',
        action: this.uploadImage,
        className: 'material-icons mi-image no-disable no-mobile no-ajaxy',
        title: 'Insert Image',
      }
    ];
  }

  componentDidMount() {
    this.easymde = new Easymde({
      element: this.element,
      forceSync: true,
      minHeight: this.props.height,
      toolbar: this.toolbarItems,
      autoDownloadFontAwesome: false,
      status: false,
      spellChecker: false,
      uploadImage: true,
    });

    this.easymde.codemirror.on('change', () => {
      this.onTextareaChanged(this.easymde.value());
    });

    // Existing code for inlineAttachment (if needed)
    if (this.easymde && this.props.allowImageUpload) {
      if (!this.props.inlineImageUploadUrl) return Log.error('Invalid inlineImageUploadUrl Prop.');

      const $el = $(this.element);
      const self = this;
      if (!$el.hasClass('hasInlineUpload')) {
        $el.addClass('hasInlineUpload');
        window.inlineAttachment.editors.codemirror4.attach(this.easymde.codemirror, {
          onFileUploadResponse: function (xhr) {
            const result = JSON.parse(xhr.responseText);

            const filename = result[this.settings.jsonFieldName];

            if (result && filename) {
              let newValue;
              if (typeof this.settings.urlText === 'function') {
                newValue = this.settings.urlText.call(this, filename, result);
              } else {
                newValue = this.settings.urlText.replace(this.filenameTag, filename);
              }

              const text = this.editor.getValue().replace(this.lastValue, newValue);
              this.editor.setValue(text);
              this.settings.onFileUploaded.call(this, filename);
            }
            return false;
          },
          onFileUploadError: function (xhr) {
            const result = xhr.responseText;
            const text = this.editor.getValue() + ' ' + result;
            this.editor.setValue(text);
          },
          extraHeaders: self.props.inlineImageUploadHeaders,
          errorText: 'Error uploading file: ',
          uploadUrl: self.props.inlineImageUploadUrl,
          jsonFieldName: 'filename',
          urlText: '![Image]({filename})'
        });

        EasyMDE.attachFileDesc(self.element);
      }
    }
  }

  componentDidUpdate() {
    if (this.easymde && this.easymde.value() !== this.state.value) {
      this.easymde.value(this.state.value);
      this.easymde.codemirror.refresh();
    }
  }

  componentWillUnmount() {
    if (this.easymde) {
      this.easymde.codemirror.off('change');
      this.easymde = null;
    }
  }

  static getDerivedStateFromProps(nextProps, state) {
    if (typeof nextProps.defaultValue !== 'undefined') {
      if (!state.loaded && nextProps.defaultValue !== state.value)
        return { value: nextProps.defaultValue.replace(/\\n/gi, '\n'), loaded: true };
    }

    return null;
  }

  static attachFileDesc(textarea) {
    const $el = $(textarea);
    const attachFileDiv = $('<div></div>');
    attachFileDiv
      .addClass('attachFileDesc')
      .html('<p>Attach images by dragging & dropping or pasting from clipboard.</p>');
    $el.siblings('.CodeMirror').addClass('hasFileDesc');
    $el
      .siblings('.editor-statusbar')
      .addClass('hasFileDesc')
      .prepend(attachFileDiv);
  }

  onTextareaChanged(value) {
    this.setState({
      value
    });

    if (this.props.onChange) this.props.onChange(value);
  }

  getEditorText() {
    return this.state.value;
  }

  setEditorText(value) {
    this.setState({
      value
    });
  }

  uploadImage(editor) {
    // Create an input element to select files
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    // Handle the file selection
    input.onchange = () => {
      const file = input.files[0];
      if (file) {
        // Create FormData to send the file
        const formData = new FormData();
        formData.append('file', file);

        // Send an AJAX request to upload the image
        fetch(this.props.inlineImageUploadUrl, {
          method: 'POST',
          headers: {
            ...this.props.inlineImageUploadHeaders
          },
          body: formData
        })
        .then(response => response.json())
        .then(result => {
          // Get the image URL from the server response
          const imageUrl = result.filename; // Adjust based on your API response

          // Insert the image into the editor at the cursor position
          const cm = editor.codemirror;
          const doc = cm.getDoc();
          const cursor = doc.getCursor();
          const markdownImage = `![Image](${imageUrl})`;
          doc.replaceRange(markdownImage, cursor);
        })
        .catch(error => {
          console.error('Error uploading image:', error);
        });
      }
    };

    // Trigger the file input dialog
    input.click();
  }

  render() {
    setTimeout(() => {
      if (this.easymde && this.easymde.codemirror) {
        this.easymde.codemirror.refresh();
      }
    }, 250);
    return (
      <Fragment>
        <textarea ref={i => (this.element = i)} value={this.state.value} onChange={e => this.onTextareaChanged(e)} />
        {this.props.showStatusBar && <div className='editor-statusbar uk-float-left uk-width-1-1' />}
      </Fragment>
    );
  }
}

EasyMDE.propTypes = {
  height: PropTypes.string,
  value: PropTypes.string,
  onChange: PropTypes.func,
  defaultValue: PropTypes.string,
  allowImageUpload: PropTypes.bool,
  inlineImageUploadUrl: PropTypes.string,
  inlineImageUploadHeaders: PropTypes.object,
  showStatusBar: PropTypes.bool.isRequired
};

EasyMDE.defaultProps = {
  height: '150px',
  allowImageUpload: false,
  showStatusBar: true
};

export default EasyMDE;
