import React, { Component } from 'react';
import * as d3 from 'd3';
import data_6h_file from '../data/expected_wastage_rate_6hour.csv';
import data_28d_file from '../data/expected_wastage_rate_28day.csv';
import './Home.css';

function IsNumeric(input)
{
    // eslint-disable-next-line
    return (input - 0) == input && (''+input).trim().length > 0;
}

// function objectsAreEqual(a, b) {
//     if (Object.keys(a) !== Object.keys(b))
//         return false;
//     return Object.keys(a).every(key => a[key] === b[key]);
// }

class Home extends Component {

    constructor(props) {
        super(props);

        this.state = {
            data_6hr: [],
            data_28day: [],
            numDosesAdministered: '',      // 50000
            numLocations: '',                // 200
            numDays: '',                      // 10
            closedVialWastage: 1,
            numStorageLevels: 3,
            closedVialWastageCheckbox: false,
            openedVialWastage: 5,
            openedVialWastageCheckbox: false,
            meanDosesAdministered: null,
            numSessions: null,
            expected_wastage: null
        }
        this.handleInputChange = this.handleInputChange.bind(this);
    }

    componentDidMount() {
        d3.csv(data_6h_file).then(data => this.setState({data_6hr: data}));
        d3.csv(data_28d_file).then(data => this.setState({data_28day: data}));
    }

    handleInputChange(e) {
        //console.log('handleInputChange', e.target.name, e.target.value);
        const name = e.target.name;
        //const value = e.target.value;
        const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;

        if(localStorage) {
            localStorage.setItem(name, value);
        }

        if (!name.includes('Checkbox') && value.length > 0 && !IsNumeric(value)) {
            alert('Input values must be numeric');
            return;
        }

        this.setState({
            [name]: value
        }, () => this.calculateParams());
    }

    calculateParams = () => {
        //console.log('calculateParams called');
        const numSessions = this.state.numDays * this.state.numLocations;
        const meanDosesAdministered = this.state.numDosesAdministered / numSessions;

        this.setState({
            numSessions,
            meanDosesAdministered
        }, () => {
            if (['numSessions', 'numDosesAdministered', 'meanDosesAdministered'].every(key => this.state[key] && isFinite(this.state[key]))) {
                this.findExpectedWastage();
            }
        });
    }

    findRowIndex(data_array) {
        let idx = null;
        for (let i=0; i<data_array.length-1; i++) {
            if (data_array[i]['mean doses per period'] <= this.state.meanDosesAdministered
            && this.state.meanDosesAdministered <= data_array[i+1]['mean doses per period']) {
                idx = i;
            }
        }
        // console.log('idx', idx);
        // console.log(data_array[idx])
        // console.log(data_array[idx+1])
        return idx;
    }

    calcExpectedWastage = (data_array, idx, dosesPerVial) => {
        const exp_wastage1 = data_array[idx][dosesPerVial + ' dose vial'];
        const exp_wastage2 = data_array[idx+1][dosesPerVial + ' dose vial'];
        const mean_doses1 = data_array[idx]['mean doses per period']
        const mean_doses2 = data_array[idx+1]['mean doses per period']
        const calculated_mean_doses = this.state.meanDosesAdministered;
        let expected_wastage = parseFloat(exp_wastage1) 
                               + parseFloat((calculated_mean_doses - mean_doses1) / (mean_doses2 - mean_doses1)) 
                               * parseFloat(exp_wastage2 - exp_wastage1);

        console.log('expected_wastage before', expected_wastage);

        const Wc = this.state.closedVialWastageCheckbox ? this.state.closedVialWastage / 100 : 0;
        const n  = this.state.closedVialWastageCheckbox ? this.state.numStorageLevels : 0;
        const Wo = this.state.openedVialWastageCheckbox ? this.state.openedVialWastage / 100 : 0;

        // console.log('this.state.closedVialWastageCheckbox', this.state.closedVialWastageCheckbox)
        // console.log('this.state.openedVialWastageCheckbox', this.state.openedVialWastageCheckbox)
        // console.log('Wc', Wc)
        // console.log('n', n)
        // console.log('Wo', Wo)
        // console.log('((1 - Wc) ** n) = ', ((1 - Wc) ** n))
        // console.log('(1 - Wo) = ', (1 - Wo))
        console.log('1 - ((1 - Wc) ** n) * (1 - Wo) = ', 1 - ((1 - Wc) ** n) * (1 - Wo));

        expected_wastage = 1 - (1 - expected_wastage) * ((1 - Wc) ** n) * (1 - Wo);

        if (expected_wastage > 1.0)
            expected_wastage = 1.0;

        console.log('expected_wastage after', expected_wastage);
        console.log('');

        // console.log('exp_wastage1', exp_wastage1);
        // console.log('exp_wastage2', exp_wastage2);
        // console.log('mean_doses1', mean_doses1);
        // console.log('mean_doses2', mean_doses2);
        // console.log('calculated_mean_doses', calculated_mean_doses);
        // console.log('exp_wastage2 - exp_wastage1', exp_wastage2 - exp_wastage1);
        // console.log('expected_wastage', expected_wastage);
        return expected_wastage;
    }

    findExpectedWastage = () => {
        const expected_wastage_obj = {
            '6hr': {},
            '28day': {}
        };
        for (let discardPeriod of ['6hr', '28day']) {
            //console.log('discardPeriod', discardPeriod);
            const data_array = this.state['data_' + String(discardPeriod)];
            const idx = this.findRowIndex(data_array);
            if (idx) {
                for (let dosesPerVial of [2, 5, 10, 20]) {
                    //console.log('dosesPerVial', dosesPerVial);
                    expected_wastage_obj[discardPeriod][dosesPerVial] = this.calcExpectedWastage(data_array, idx, dosesPerVial);
                }
            }
        }
        
        this.setState({
            expected_wastage: expected_wastage_obj
        }, () => console.log('expected_wastage', this.state.expected_wastage));
    }

    renderResults = () => {
        if (['numSessions', 'numDosesAdministered', 'meanDosesAdministered'].some(key => !this.state[key] || !isFinite(this.state[key]))) {
            //console.log('values have not been calculated yet, so do not render table rows')
            return;
        }
        if(!this.state.expected_wastage) {
            //console.log('expected_wastage values have not been calculated yet, so do not render table rows');
            return;       
        }

        const fieldsArray = ['expected_wastage', 'forecast_need'];
        const discardPeriods = ['6hr', '28day'];
        const dosesPerVialsArray = [2, 5, 10, 20];
        const JSX_array = [];
        for (let i=0; i<fieldsArray.length; i++) {
            let field = fieldsArray[i];
            const exp_wastage_cells = [];
            for (let discardPeriod of discardPeriods) {
                dosesPerVialsArray.forEach(dosesPerVial => {
                    const exp_wastage_val = this.state.expected_wastage[discardPeriod][dosesPerVial];
                    const exp_wastage_pc = 100 * exp_wastage_val;
                    const forecast_need = Math.ceil((this.state.numDosesAdministered / (1 - exp_wastage_val)) / dosesPerVial);
                    const keyVal = Math.random();
                    let jsx;
                    switch(field) {
                        case 'expected_wastage':
                            jsx = <td key={keyVal}>{isNaN(exp_wastage_pc) ? '-' : exp_wastage_pc.toFixed(1) + '%'}</td>
                            break;
                        case 'forecast_need':
                            jsx = <td key={keyVal}>{isNaN(forecast_need) ? '-' : forecast_need.toFixed(0)}</td>
                            break;
                        default:
                            jsx = <td key={keyVal}>ValueError({field})</td>
                            break;
                    }
                    exp_wastage_cells.push(jsx);
                });
            }
            let fieldText;
            switch(field) {
                case 'expected_wastage':
                    fieldText = 'Expected Wastage';
                    break;
                case 'forecast_need':
                    fieldText = 'Forecast Need (vials)';
                    break;
                default:
                    break;
            }
            const rowJSX = (
                <tr key={field}>
                    <td>{fieldText}</td>
                    { exp_wastage_cells }
                </tr>
            );
            JSX_array.push(rowJSX)               
        }
        return JSX_array;
    }

    renderResultsTable = () => {
        if (['numSessions', 'numDosesAdministered', 'meanDosesAdministered'].some(key => !this.state[key] || !isFinite(this.state[key]))) {
            //console.log('values have not been calculated yet, so do not render table rows')
            return;
        }
        if(!this.state.expected_wastage) {
            //console.log('expected_wastage values have not been calculated yet, so do not render table rows');
            return;       
        }

        return (
            <table>
                <tbody>
                    <tr>
                        <th rowSpan="3">Variable</th>
                        <th colSpan="4">6 hours</th>
                        <th colSpan="4">28 days</th>
                    </tr>
                    <tr>
                        <th colSpan="4">Doses per vial</th>
                        <th colSpan="4">Doses per vial</th>
                    </tr>
                    <tr>
                        <th>2</th>
                        <th>5</th>
                        <th>10</th>
                        <th>20</th>
                        <th>2</th>
                        <th>5</th>
                        <th>10</th>
                        <th>20</th>                        
                    </tr>                            
                    { this.renderResults() }
                </tbody>
            </table> 
        );
    }

    render() {
        return (
            <div className="home-container">
                <form className="input-form">
                    <h3 className="input-form-title">Vaccine & Campaign inputs</h3> 

                    <div className="form-controls-grid-container">                        

                        <div className="grid-numDosesAdministered">
                            <label htmlFor="numDosesAdministered">Number of doses administered</label>
                            <input type="text" name="numDosesAdministered" id="numDosesAdministered" 
                                    ref={this.refNumDosesAdministered} placeholder="e.g. 50000"
                                    value={this.state.numDosesAdministered} onChange={this.handleInputChange} />
                        </div>       

                        <div className="grid-numLocations"> 
                            <label htmlFor="numLocations">Number of vaccination locations (or teams)</label>
                            <input type="text" name="numLocations" id="numLocations" placeholder="e.g. 200"
                                                        value={this.state.numLocations} onChange={this.handleInputChange} />
                        </div>   

                        <div className="grid-numDays">     
                            <label htmlFor="numDays">Number of days</label>
                            <input type="text" name="numDays" id="numDays" placeholder="e.g. 10"
                                                    value={this.state.numDays} onChange={this.handleInputChange} />                                                                        
                        </div>  

                        {/* ====================================================================================== */}

                        <div className="grid-closedVialWastage-container">
                            <div className="grid-closedVialWastageCheckbox">     
                                <label htmlFor="closedVialWastageCheckbox">
                                    <input type="checkbox" name="closedVialWastageCheckbox" id="closedVialWastageCheckbox" 
                                            value={this.state.closedVialWastageCheckbox} onChange={this.handleInputChange} />                         
                                    &nbsp;Include closed vial wastage?
                                </label>                                                                       
                            </div>  
                            
                            <div className="grid-closedVialWastageInputTextLabel">   
                                <label className="grid-closedVialWastageInputTextLabel" 
                                        htmlFor="closedVialWastage">Closed vial wastage (%)</label>
                            </div>
                            <div  className="grid-closedVialWastageInputText">
                                <input type="text" name="closedVialWastage" id="closedVialWastage" placeholder="e.g. 1"
                                       value={this.state.closedVialWastage} onChange={this.handleInputChange}
                                       disabled={!this.state.closedVialWastageCheckbox} />   
                            </div>                                                                    
                                                    
                            <div className="grid-numStorageLevelsLabels">     
                                <label className="grid-numStorageLevelsLabel" 
                                        htmlFor="numStorageLevels">Number of storage levels</label>
                            </div>
                            <div className="grid-numStorageLevels"> 
                                <input type="text" name="numStorageLevels" id="numStorageLevels" placeholder="e.g. 3"
                                       value={this.state.numStorageLevels} onChange={this.handleInputChange}
                                       disabled={!this.state.closedVialWastageCheckbox} />                                                                        
                            </div>  
                        </div>                                              

                        {/* ====================================================================================== */}

                        <div className="grid-openedVialWastage-container">
                            <div className="grid-openedVialWastageCheckbox">     
                                <label htmlFor="openedVialWastageCheckbox">
                                    <input type="checkbox" name="openedVialWastageCheckbox" id="openedVialWastageCheckbox" 
                                            value={this.state.openedVialWastageCheckbox} onChange={this.handleInputChange} />                         
                                    &nbsp;Include avoidable opened vial wastage?
                                </label>                                                                       
                            </div>   

                            <div className="grid-openedVialWastageInputTextLabel">     
                                <label className="grid-openedVialWastageInputTextLabel" 
                                         htmlFor="openedVialWastage">Avoidable opened vial wastage (%)</label>
                            </div>
                            <div className="grid-openedVialWastageInputText">
                                <input type="text" name="openedVialWastage" id="openedVialWastage" placeholder="e.g. 5"
                                       value={this.state.openedVialWastage} onChange={this.handleInputChange}
                                       disabled={!this.state.openedVialWastageCheckbox} />                                                                        
                            </div> 
                        </div>  

                    </div>                                         
                </form>

                {/* =========================================================================================================== */}

                <div className="results-container">
                    <div className="calculated-params-container">
                        <table className="calculated-params-table">
                            <tbody>
                                <tr>
                                    <td width="70%">Number of sessions:</td>
                                    <td>{ this.state.numSessions && this.state.numSessions }</td>
                                </tr>
                                <tr>
                                    <td width="70%">Mean doses administered:</td>
                                    <td>{ this.state.meanDosesAdministered && isFinite(this.state.meanDosesAdministered) 
                                            ? this.state.meanDosesAdministered.toFixed(2) : '' }</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    { this.renderResultsTable() }
                </div>
            </div>
        );
    }
}

export default Home;