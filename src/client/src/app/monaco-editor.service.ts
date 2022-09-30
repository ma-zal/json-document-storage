import { Injectable } from '@angular/core';
import { editor as MonacoEditor/*, languages as MonacoLanguages*/ } from 'monaco-editor';
import { URI } from 'monaco-editor/esm/vs/base/common/uri';

@Injectable({
  providedIn: 'root'
})
export class MonacoEditorService {

  constructor() { }

  public setModelValue(value: string, language: 'json'| undefined, uri: URI) {
    const monacoEditor = this.getEditor();
    const existingContentModel = monacoEditor.getModel(uri);
    if (existingContentModel) {
      existingContentModel.setValue(value);
    } else {
      monacoEditor.createModel(value, language, uri);
    }
  }

  public getModelEditorValue(uri: URI) {
    const monacoEditor = this.getEditor();
    const model = monacoEditor.getModel(uri);
    if (!model) {
      throw new Error(`Model ${uri} is missing.`);
    }
    return model.getValue();
  }

  /**
   * @param targetModelUri 
   * @param savedStates This object is not a part of service, but should be part of component,
   *                     because it should be destroyed on component destroy.
   */
  public switchMonacoEditorModel(targetModelUri: URI, savedStates: Record<string, MonacoEditor.ICodeEditorViewState>) {
    const editor = this.getEditor();
    const editorInstance = editor.getEditors()[0];
    const currentModel = editorInstance.getModel();
    if (!currentModel) {
      return;
    }
    const currentUriString = currentModel.uri.toString();
    if (currentUriString === targetModelUri.toString()) {
      // Nothing to do;
      return;
    }
    // Save current editor state for future restoration
    const currentViewState = editor.getEditors()[0].saveViewState();
    if (currentViewState) {
      savedStates[currentUriString] = currentViewState;
    }
    
    const targetModel = editor.getModel(targetModelUri);
    editorInstance.setModel(targetModel);
    const targetViewState = savedStates[targetModelUri.toString()];
    if (targetViewState) {
      editorInstance.restoreViewState(targetViewState);
    }
  }

  public getEditor() {
    return (window as any).monaco.editor as typeof MonacoEditor;
  }
  
}
