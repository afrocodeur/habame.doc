

const Helper = {
    clone: function(object) {
        return JSON.parse(JSON.stringify(object));
    }    
};

export default Helper;